#!/usr/bin/env python3
"""Validate data-quality rule assets against JSON Schema Draft 2020-12.

Validates:
- rules/core and rules/extensions against schemas/rule-schema.json
- rules/datasets against schemas/dataset-config-schema.json
- rules/semantic_types against schemas/semantic-types-schema.json

Also performs optional reference checks and a lightweight Great Expectations suite shape check.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: PyYAML. Install with `pip install pyyaml`."
    ) from exc

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: jsonschema. Install with `pip install jsonschema`."
    ) from exc

SUPPORTED_EXTENSIONS = {".yaml", ".yml", ".json"}


@dataclass(frozen=True)
class ValidationTarget:
    name: str
    schema_path: Path
    search_paths: tuple[Path, ...]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate DQ rule/config/schema assets.")
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Project root path (defaults to repository root).",
    )
    parser.add_argument(
        "--strict-references",
        action="store_true",
        help="Fail validation if dataset/semantic files reference unknown rule IDs.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print every validated file.",
    )
    return parser.parse_args()


def load_payload(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(text)
    return yaml.safe_load(text)


def find_files(paths: Iterable[Path]) -> list[Path]:
    files: list[Path] = []
    for base in paths:
        if not base.exists():
            continue
        for file_path in sorted(base.rglob("*")):
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                files.append(file_path)
    return files


def pointer_from_path(path_tokens: Iterable[Any]) -> str:
    pointer = "$"
    for token in path_tokens:
        pointer += f"/{token}"
    return pointer


def validate_document(
    validator: Draft202012Validator, payload: Any, file_path: Path
) -> list[str]:
    errors: list[str] = []

    if isinstance(payload, list):
        for index, item in enumerate(payload):
            if not isinstance(item, dict):
                errors.append(
                    f"{file_path}[{index}]: expected object, got {type(item).__name__}."
                )
                continue
            item_errors = sorted(
                validator.iter_errors(item), key=lambda err: list(err.absolute_path)
            )
            for err in item_errors:
                errors.append(
                    f"{file_path}[{index}]: {pointer_from_path(err.absolute_path)} {err.message}"
                )
        return errors

    if not isinstance(payload, dict):
        return [f"{file_path}: expected object or list, got {type(payload).__name__}."]

    item_errors = sorted(validator.iter_errors(payload), key=lambda err: list(err.absolute_path))
    for err in item_errors:
        errors.append(f"{file_path}: {pointer_from_path(err.absolute_path)} {err.message}")

    return errors


def extract_rule_ids(payload: Any) -> set[str]:
    ids: set[str] = set()
    if isinstance(payload, dict):
        rule_id = payload.get("rule_id")
        if isinstance(rule_id, str):
            ids.add(rule_id)
        return ids

    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                rule_id = item.get("rule_id")
                if isinstance(rule_id, str):
                    ids.add(rule_id)
    return ids


def extract_referenced_rule_ids(payload: Any) -> set[str]:
    refs: set[str] = set()

    if isinstance(payload, dict):
        rules = payload.get("rules")
        if isinstance(rules, list):
            for item in rules:
                if isinstance(item, dict):
                    rule_id = item.get("rule_id")
                    if isinstance(rule_id, str):
                        refs.add(rule_id)

        default_rules = payload.get("default_rules")
        if isinstance(default_rules, list):
            for item in default_rules:
                if isinstance(item, str):
                    refs.add(item)

    return refs


def validate_ge_suite_shape(path: Path) -> list[str]:
    if not path.exists():
        return []

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"{path}: invalid JSON: {exc}"]

    errors: list[str] = []
    if not isinstance(payload, dict):
        return [f"{path}: expected object at root."]

    suite_name = payload.get("expectation_suite_name")
    expectations = payload.get("expectations")

    if not isinstance(suite_name, str) or not suite_name.strip():
        errors.append(f"{path}: expectation_suite_name must be a non-empty string.")

    if not isinstance(expectations, list):
        errors.append(f"{path}: expectations must be a list.")
    else:
        for index, item in enumerate(expectations):
            if not isinstance(item, dict):
                errors.append(f"{path}[expectations/{index}]: expected object.")
                continue
            if "expectation_type" not in item:
                errors.append(
                    f"{path}[expectations/{index}]: missing expectation_type field."
                )
    return errors


def main() -> int:
    args = parse_args()
    root = args.project_root.resolve()

    targets = [
        ValidationTarget(
            name="rule definitions",
            schema_path=root / "schemas" / "rule-schema.json",
            search_paths=(root / "rules" / "core", root / "rules" / "extensions"),
        ),
        ValidationTarget(
            name="dataset configs",
            schema_path=root / "schemas" / "dataset-config-schema.json",
            search_paths=(root / "rules" / "datasets",),
        ),
        ValidationTarget(
            name="semantic types",
            schema_path=root / "schemas" / "semantic-types-schema.json",
            search_paths=(root / "rules" / "semantic_types",),
        ),
    ]

    all_errors: list[str] = []
    warnings: list[str] = []
    known_rule_ids: set[str] = set()
    referenced_rule_ids: set[str] = set()

    for target in targets:
        if not target.schema_path.exists():
            all_errors.append(f"Missing schema file: {target.schema_path}")
            continue

        try:
            schema_payload = json.loads(target.schema_path.read_text(encoding="utf-8"))
        except Exception as exc:
            all_errors.append(f"Unable to parse schema {target.schema_path}: {exc}")
            continue

        validator = Draft202012Validator(schema_payload)
        files = find_files(target.search_paths)

        if args.verbose:
            print(f"[{target.name}] files: {len(files)}")

        for file_path in files:
            if args.verbose:
                print(f"  - validating {file_path.relative_to(root)}")

            try:
                payload = load_payload(file_path)
            except Exception as exc:
                all_errors.append(f"{file_path}: unable to parse document: {exc}")
                continue

            all_errors.extend(validate_document(validator, payload, file_path))

            if target.name == "rule definitions":
                known_rule_ids.update(extract_rule_ids(payload))
            else:
                referenced_rule_ids.update(extract_referenced_rule_ids(payload))

    ge_suite_path = (
        root
        / "integrations"
        / "great_expectations"
        / "suites"
        / "core_suite.json"
    )
    all_errors.extend(validate_ge_suite_shape(ge_suite_path))

    missing_refs = sorted(referenced_rule_ids - known_rule_ids)
    if missing_refs:
        for missing in missing_refs:
            warnings.append(f"Referenced rule ID not found in rules/core or rules/extensions: {missing}")

    print("Data Quality asset validation summary")
    print(f"- Known rule IDs: {len(known_rule_ids)}")
    print(f"- Referenced rule IDs: {len(referenced_rule_ids)}")
    print(f"- Errors: {len(all_errors)}")
    print(f"- Warnings: {len(warnings)}")

    if warnings:
        print("\nWarnings:")
        for warning in warnings:
            print(f"- {warning}")

    if all_errors:
        print("\nErrors:")
        for error in all_errors:
            print(f"- {error}")
        return 1

    if args.strict_references and warnings:
        return 1

    print("\nValidation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
