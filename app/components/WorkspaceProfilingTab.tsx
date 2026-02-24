'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Network, Play, RefreshCw } from 'lucide-react';
import {
  buildWorkspaceDataProfiling,
  ProfilingSamplingMode,
  ProfilingRemediationItem,
  WorkspaceProfilingResult,
} from '@/lib/workspace/data-profiling';
import { buildDatasetProfile } from '@/lib/workspace/profile';
import { ImportedDataset, Workspace } from '@/types/workspace';
import { Shield, BookKey, FileSearch, Save, TableColumnsSplit, Database, Settings2 } from 'lucide-react';

interface WorkspaceProfilingTabProps {
  workspace: Workspace;
  defaultFocusedDatasetId?: string;
  onOpenKnowledgeGraph?: () => void;
}

type SectionId =
  | 'structural'
  | 'content'
  | 'relationships'
  | 'metadata'
  | 'classification'
  | 'automation'
  | 'visualization'
  | 'integration';

type RemediationOverride = {
  status: ProfilingRemediationItem['status'];
  owner: string;
  note: string;
};

type AppliedProfilingOptions = {
  focusedDatasetId?: string;
  samplingMode: ProfilingSamplingMode;
  customSampleSize?: number;
};

type ReusableRuleStatus = 'pass' | 'warn' | 'fail';

interface ReusableRule {
  id: string;
  name: string;
  description: string;
  category: string;
  appliesTo: 'dataset' | 'column' | 'cross_table';
  failedDatasets: number;
  status: ReusableRuleStatus;
  guidance: string;
}

const SECTION_TITLES: Record<SectionId, string> = {
  structural: 'Structural Analysis (Structure Discovery)',
  content: 'Content Analysis (Statistical Profiling)',
  relationships: 'Relationship Discovery (Cross-Table Analysis)',
  metadata: 'Metadata Management and Data Cataloging',
  classification: 'Data Classification (PII/PHI Detection)',
  automation: 'Automation and Performance Capabilities',
  visualization: 'Visualization and Reporting',
  integration: 'Integration and Collaboration',
};

const DEFAULT_COLLAPSED_SECTIONS: Record<SectionId, boolean> = {
  structural: true,
  content: true,
  relationships: true,
  metadata: true,
  classification: true,
  automation: true,
  visualization: true,
  integration: true,
};

const PROFILING_FUNCTIONS: Array<{ category: string; examples: string; description: string }> = [
  {
    category: 'Mathematical',
    examples: 'ABS, POWER, LOG',
    description: 'Measures completeness patterns and numeric behavior across records.',
  },
  {
    category: 'Aggregate',
    examples: 'AVG, COUNT, MAX, VARIANCE',
    description: 'Summarizes rows/columns into quality indicators and score inputs.',
  },
  {
    category: 'Text',
    examples: 'FIND, CHAR_LENGTH, TRIM',
    description: 'Validates string formatting, casing, whitespace, and malformed entries.',
  },
  {
    category: 'Date & Time',
    examples: 'DATE_DIFF, EXTRACT, TIMEZONE',
    description: 'Evaluates freshness, delay windows, and temporal consistency.',
  },
  {
    category: 'Window',
    examples: 'ROW_NUMBER, ROLLING COUNT, MOVING MAX',
    description: 'Profiles drift and trend anomalies across rolling partitions.',
  },
  {
    category: 'Web',
    examples: 'JSON_EXTRACT, XML_PARSE',
    description: 'Profiles semi-structured payloads and nested service fields.',
  },
];

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Intl.NumberFormat('en-US').format(value);
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function fileSafeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function severityClasses(severity: ProfilingRemediationItem['severity']): string {
  if (severity === 'high') return 'bg-red-500/20 text-red-200 border border-red-400/30';
  if (severity === 'medium') return 'bg-amber-500/20 text-amber-200 border border-amber-400/30';
  return 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30';
}

function stageStatusClasses(status: 'ready' | 'in_progress' | 'attention'): string {
  if (status === 'ready') return 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/30';
  if (status === 'in_progress') return 'bg-cyan-600/20 text-cyan-200 border border-cyan-500/30';
  return 'bg-amber-600/20 text-amber-200 border border-amber-500/30';
}

function ruleStatusClasses(status: ReusableRuleStatus): string {
  if (status === 'pass') return 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/30';
  if (status === 'warn') return 'bg-amber-600/20 text-amber-200 border border-amber-500/30';
  return 'bg-red-600/20 text-red-200 border border-red-500/30';
}

function buildRemediationCsv(
  result: WorkspaceProfilingResult,
  overrides: Record<string, RemediationOverride>
): string {
  const headers = ['dataset', 'issue_title', 'severity', 'status', 'owner', 'detail', 'note'];
  const rows = result.integration.remediationItems.map((item) => {
    const override = overrides[item.id];
    const status = override?.status || item.status;
    const owner = override?.owner?.trim() || item.owner || '';
    const note = override?.note?.trim() || item.note || '';
    const cells = [
      item.datasetName,
      item.title,
      item.severity,
      status,
      owner,
      item.detail,
      note,
    ];
    return cells.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

function inferSamplingSize(totalRows: number, options: AppliedProfilingOptions): number {
  if (totalRows <= 0) return 0;
  if (options.samplingMode === 'full') return totalRows;
  if (options.samplingMode === 'custom') {
    const custom = Math.floor(Number(options.customSampleSize || 0));
    if (custom > 0) return Math.min(totalRows, custom);
  }
  return Math.min(totalRows, Math.max(1500, Math.floor(Math.sqrt(totalRows) * 50)));
}

function sampleRows(dataset: ImportedDataset, options: AppliedProfilingOptions): Record<string, unknown>[] {
  const size = inferSamplingSize(dataset.records.length, options);
  return dataset.records.slice(0, size);
}

function detectColumnPattern(columnName: string): string {
  const normalized = columnName.toLowerCase();
  if (normalized.includes('email')) return 'email';
  if (normalized.includes('phone') || normalized.includes('mobile')) return 'phone';
  if (normalized.includes('zip') || normalized.includes('postal')) return 'postal';
  if (normalized.includes('date') || normalized.includes('time')) return 'date/time';
  if (normalized.includes('id')) return 'identifier';
  return 'general';
}

function ruleStatusFromFailures(failedDatasets: number, totalDatasets: number): ReusableRuleStatus {
  if (failedDatasets === 0) return 'pass';
  const warnThreshold = Math.max(1, Math.floor(totalDatasets * 0.35));
  return failedDatasets <= warnThreshold ? 'warn' : 'fail';
}

const PREDEFINED_CLASSIFICATIONS = [
  { id: 'ccpa', name: 'CCPA', desc: 'California Consumer Privacy Act' },
  { id: 'ferpa', name: 'FERPA', desc: 'Family Educational Rights and Privacy Act' },
  { id: 'gdpr', name: 'GDPR', desc: 'General Data Protection Regulation' },
  { id: 'hipaa', name: 'HIPAA', desc: 'Health Insurance Portability and Accountability Act' },
  { id: 'pci', name: 'PCI', desc: 'Payment Card Industry' },
  { id: 'pii', name: 'PII', desc: 'Personally Identifiable Information' },
];

type ClassificationResult = {
  id: string;
  datasetName: string;
  columnName: string;
  currentClassification: string;
  suggestedClassification: string;
  currentDomain: string;
  suggestedDomain: string;
  matchType: 'Name/Title' | 'Glossary Link' | 'Similar Column';
};

export default function WorkspaceProfilingTab({
  workspace,
  defaultFocusedDatasetId,
  onOpenKnowledgeGraph,
}: WorkspaceProfilingTabProps) {
  const [focusedDatasetId, setFocusedDatasetId] = useState(defaultFocusedDatasetId || '');
  const [samplingMode, setSamplingMode] = useState<ProfilingSamplingMode>('auto');
  const [customSampleSize, setCustomSampleSize] = useState('5000');
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>(
    DEFAULT_COLLAPSED_SECTIONS
  );

  const [classificationDatasetId, setClassificationDatasetId] = useState<string>('');
  const [activeClassification, setActiveClassification] = useState<string>('pii');
  const [classificationViewMode, setClassificationViewMode] = useState<'table' | 'column'>('table');
  const [classificationSearch, setClassificationSearch] = useState('');
  const [classificationResults, setClassificationResults] = useState<ClassificationResult[] | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);

  const [remediationOverrides, setRemediationOverrides] = useState<Record<string, RemediationOverride>>({});
  const [appliedOptions, setAppliedOptions] = useState<AppliedProfilingOptions>({
    focusedDatasetId: defaultFocusedDatasetId || workspace.activeDatasetId || workspace.datasets[0]?.id,
    samplingMode: 'auto',
  });
  const [runVersion, setRunVersion] = useState(0);
  const [lastRunAt, setLastRunAt] = useState(new Date().toISOString());
  const firstDatasetId = workspace.datasets[0]?.id || '';

  useEffect(() => {
    const fallbackDatasetId =
      defaultFocusedDatasetId || workspace.activeDatasetId || firstDatasetId;
    setFocusedDatasetId(fallbackDatasetId);
    setSamplingMode('auto');
    setCustomSampleSize('5000');
    setCollapsedSections(DEFAULT_COLLAPSED_SECTIONS);
    setRemediationOverrides({});
    setAppliedOptions({
      focusedDatasetId: fallbackDatasetId || undefined,
      samplingMode: 'auto',
    });
    setRunVersion((previous) => previous + 1);
    setLastRunAt(new Date().toISOString());
  }, [defaultFocusedDatasetId, firstDatasetId, workspace.activeDatasetId, workspace.id]);

  const runClassification = () => {
    setIsClassifying(true);
    // Simulate classification process
    setTimeout(() => {
      const mockResults: ClassificationResult[] = [
        { id: '1', datasetName: workspace.datasets[0]?.name || 'users', columnName: 'email', currentClassification: 'None', suggestedClassification: 'Sensitive', currentDomain: 'None', suggestedDomain: 'Email Address', matchType: 'Name/Title' },
        { id: '2', datasetName: workspace.datasets[0]?.name || 'users', columnName: 'phone', currentClassification: 'None', suggestedClassification: 'Sensitive', currentDomain: 'None', suggestedDomain: 'Phone Number', matchType: 'Name/Title' },
        { id: '3', datasetName: workspace.datasets[1]?.name || 'patients', columnName: 'medical_record_no', currentClassification: 'None', suggestedClassification: 'Highly Sensitive', currentDomain: 'None', suggestedDomain: 'Health Identifier', matchType: 'Glossary Link' },
        { id: '4', datasetName: workspace.datasets[1]?.name || 'employees', columnName: 'ssn', currentClassification: 'None', suggestedClassification: 'Critical Sensitive', currentDomain: 'None', suggestedDomain: 'National ID', matchType: 'Name/Title' },
        { id: '5', datasetName: workspace.datasets[0]?.name || 'orders', columnName: 'credit_card', currentClassification: 'None', suggestedClassification: 'Critical Sensitive', currentDomain: 'None', suggestedDomain: 'Payment Info', matchType: 'Similar Column' },
      ];
      setClassificationResults(mockResults);
      setIsClassifying(false);
    }, 1200);
  };

  const filteredClassificationResults = useMemo(() => {
    if (!classificationResults) return null;
    let res = classificationResults;
    if (classificationDatasetId) {
      res = res.filter(r => r.datasetName === workspace.datasets.find(d => d.id === classificationDatasetId)?.name);
    }
    if (classificationSearch) {
      const lowerSearch = classificationSearch.toLowerCase();
      res = res.filter(r =>
        r.columnName.toLowerCase().includes(lowerSearch) ||
        r.datasetName.toLowerCase().includes(lowerSearch) ||
        r.suggestedDomain.toLowerCase().includes(lowerSearch)
      );
    }
    return res;
  }, [classificationResults, classificationDatasetId, classificationSearch, workspace.datasets]);

  const profilingResult = useMemo(() => {
    void runVersion;
    return buildWorkspaceDataProfiling(workspace, appliedOptions);
  }, [appliedOptions, runVersion, workspace]);

  const remediationItems = useMemo(
    () =>
      profilingResult.integration.remediationItems.map((item) => {
        const override = remediationOverrides[item.id];
        return {
          ...item,
          status: override?.status || item.status,
          owner: override?.owner || item.owner,
          note: override?.note || item.note,
        };
      }),
    [profilingResult.integration.remediationItems, remediationOverrides]
  );

  const remediationCounts = useMemo(() => {
    const counts = { open: 0, in_progress: 0, resolved: 0 };
    remediationItems.forEach((item) => {
      counts[item.status] += 1;
    });
    return counts;
  }, [remediationItems]);

  const totalOutliers = useMemo(
    () =>
      profilingResult.content.descriptiveStats.reduce((total, entry) => total + entry.outlierCount, 0),
    [profilingResult.content.descriptiveStats]
  );

  const datasetProfiles = useMemo(
    () =>
      workspace.datasets.map((dataset) => ({
        dataset,
        profile: buildDatasetProfile(dataset),
      })),
    [workspace.datasets]
  );

  const automatedColumnProfiles = useMemo(() => {
    return datasetProfiles
      .flatMap(({ dataset, profile }) => {
        const sampled = sampleRows(dataset, appliedOptions);
        const metricByColumn = new Map(
          profile.columnMetrics.map((metric) => [metric.column, metric])
        );

        return dataset.columns.map((column) => {
          const values = sampled
            .map((row) => row[column])
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
          const frequency = new Map<string, number>();
          values.forEach((value) => {
            const key = String(value).trim();
            frequency.set(key, (frequency.get(key) || 0) + 1);
          });
          const topValues = Array.from(frequency.entries())
            .sort((left, right) => right[1] - left[1])
            .slice(0, 5)
            .map(([value, count]) => ({ value, count }));
          const distinctCount = frequency.size;
          const metric = metricByColumn.get(column);
          const anomalyFlags: string[] = [];
          if (metric) {
            if (metric.completenessPct < 95) {
              anomalyFlags.push(`Completeness ${metric.completenessPct.toFixed(1)}%`);
            }
            if (metric.validityPct < 95) {
              anomalyFlags.push(`Validity ${metric.validityPct.toFixed(1)}%`);
            }
            if (metric.consistencyPct < 95) {
              anomalyFlags.push(`Consistency ${metric.consistencyPct.toFixed(1)}%`);
            }
            if (metric.inferredType === 'mixed') {
              anomalyFlags.push('Mixed data type signatures');
            }
          }
          if (topValues.length > 0 && values.length >= 25 && topValues[0].count / values.length > 0.9) {
            anomalyFlags.push('Single-value dominance pattern');
          }

          return {
            datasetId: dataset.id,
            datasetName: dataset.name,
            column,
            inferredType: metric?.inferredType || 'text',
            pattern: detectColumnPattern(column),
            nonNullCount: values.length,
            distinctCount,
            topValues,
            anomalyFlags,
          };
        });
      })
      .slice(0, 600);
  }, [appliedOptions, datasetProfiles]);

  const profilingTechniqueCards = useMemo(() => {
    const structureIssues = profilingResult.structural.datasets.reduce(
      (total, item) => total + item.typeMismatchColumns + item.formatViolationColumns,
      0
    );
    const contentIssues =
      profilingResult.content.anomalies.length +
      profilingResult.content.distinctAndNullStats.filter(
        (item) => item.completenessPct < 95 || item.validityPct < 95
      ).length;
    const relationshipSignals =
      profilingResult.relationships.inferredForeignKeys.length +
      profilingResult.relationships.crossChecks.length;
    const metadataMismatches = profilingResult.metadata.datasets.filter(
      (item) => item.metadataCompletenessPct < 100
    ).length;
    const fieldAnomalies = automatedColumnProfiles.filter((item) => item.anomalyFlags.length > 0).length;
    const multiFieldChecks =
      profilingResult.relationships.crossChecks.length +
      profilingResult.relationships.inferredForeignKeys.length;
    const multiFieldFailed =
      profilingResult.relationships.crossChecks.filter((item) => item.status === 'warn').length +
      profilingResult.relationships.inferredForeignKeys.filter((item) => item.orphanCount > 0).length;

    return [
      {
        title: 'Structure Discovery',
        description:
          'Validates format consistency and structure integrity across fields (example: phone digit length checks).',
        metric: `${formatNumber(structureIssues)} structural issues`,
      },
      {
        title: 'Content Discovery',
        description:
          'Detects systemic value problems such as invalid values, outliers, and malformed data points.',
        metric: `${formatNumber(contentIssues)} content issues`,
      },
      {
        title: 'Relationship Discovery',
        description:
          'Maps metadata and data overlaps to infer PK/FK and cross-dataset dependencies.',
        metric: `${formatNumber(relationshipSignals)} relationship signals`,
      },
      {
        title: 'Metadata Discovery',
        description:
          'Compares actual data behavior against expected metadata structure and business definitions.',
        metric: `${formatNumber(metadataMismatches)} metadata mismatches`,
      },
      {
        title: 'Field-Based Profiling',
        description:
          'Column-level profiling for type checks, pattern checks, frequency distributions, and outlier flags.',
        metric: `${formatNumber(fieldAnomalies)} flagged fields`,
      },
      {
        title: 'Multi-Field Profiling',
        description:
          'Cross-field and cross-table checks (such as city-state-zip compatibility and key relationship validation).',
        metric: `${formatNumber(multiFieldFailed)} / ${formatNumber(multiFieldChecks)} failed checks`,
      },
    ];
  }, [automatedColumnProfiles, profilingResult]);

  const workflowStages = useMemo(() => {
    const standardizationIssues = datasetProfiles.filter(
      (item) => item.profile.duplicationPct > 2 || item.profile.consistencyPct < 95
    ).length;
    const cleansingIssues = datasetProfiles.filter(
      (item) =>
        item.profile.validityPct < 95 ||
        item.profile.completenessPct < 95 ||
        item.profile.knownErrorCount > 0
    ).length;
    const improvementIssues = datasetProfiles.filter(
      (item) => item.profile.dataUpdateDelayHours > 24 || item.profile.pipelineIncidentCount > 0
    ).length;

    return [
      {
        stage: 'Preparation',
        status: 'ready' as const,
        detail: `Scope includes ${workspace.datasets.length} dataset(s) with focused profiling controls.`,
      },
      {
        stage: 'Data Discovery',
        status: workspace.datasets.length > 0 ? ('ready' as const) : ('attention' as const),
        detail: `Automated schema/content discovery on ${formatNumber(profilingResult.sampledRows)} sampled rows.`,
      },
      {
        stage: 'Standardization',
        status: standardizationIssues === 0 ? ('ready' as const) : ('in_progress' as const),
        detail: `${formatNumber(standardizationIssues)} dataset(s) need normalization, deduplication, or rule alignment.`,
      },
      {
        stage: 'Cleansing',
        status: cleansingIssues === 0 ? ('ready' as const) : ('in_progress' as const),
        detail: `${formatNumber(cleansingIssues)} dataset(s) require null handling, validation fixes, or enrichment.`,
      },
      {
        stage: 'Improvement',
        status: improvementIssues === 0 ? ('ready' as const) : ('attention' as const),
        detail: `${formatNumber(improvementIssues)} dataset(s) require freshness monitoring or pipeline incident remediation.`,
      },
    ];
  }, [datasetProfiles, profilingResult.sampledRows, workspace.datasets.length]);

  const reusableRules = useMemo<ReusableRule[]>(() => {
    const totalDatasets = Math.max(1, datasetProfiles.length);
    const completenessFailures = datasetProfiles.filter(
      (item) => item.profile.completenessPct < 95
    ).length;
    const validityFailures = datasetProfiles.filter((item) => item.profile.validityPct < 95).length;
    const consistencyFailures = datasetProfiles.filter(
      (item) => item.profile.consistencyPct < 95
    ).length;
    const uniquenessFailures = datasetProfiles.filter(
      (item) => item.profile.duplicationPct > 2 || item.profile.uniquenessPct < 98
    ).length;
    const timelinessFailures = datasetProfiles.filter(
      (item) => item.profile.dataUpdateDelayHours > 24
    ).length;
    const relationshipFailedDatasets = new Set([
      ...profilingResult.relationships.crossChecks
        .filter((item) => item.status === 'warn')
        .map((item) => item.datasetId),
      ...profilingResult.relationships.inferredForeignKeys
        .filter((item) => item.orphanCount > 0)
        .map((item) => item.sourceDatasetId),
    ]).size;

    return [
      {
        id: 'rule-completeness-threshold',
        name: 'Mandatory Field Completeness >= 95%',
        description:
          'Checks critical fields for null/blank volume to maintain reliable analytics and segmentation.',
        category: 'Completeness',
        appliesTo: 'column',
        failedDatasets: completenessFailures,
        status: ruleStatusFromFailures(completenessFailures, totalDatasets),
        guidance: 'Enforce required fields at ingestion and add upstream null-prevention checks.',
      },
      {
        id: 'rule-validity-threshold',
        name: 'Format and Rule Validity >= 95%',
        description:
          'Ensures values conform to expected domain rules, patterns, and accepted ranges.',
        category: 'Validity',
        appliesTo: 'column',
        failedDatasets: validityFailures,
        status: ruleStatusFromFailures(validityFailures, totalDatasets),
        guidance: 'Apply regex/range validation in pipelines and quarantine malformed records.',
      },
      {
        id: 'rule-consistency-threshold',
        name: 'Cross-System Consistency >= 95%',
        description:
          'Verifies type/format consistency so values can be joined and standardized across systems.',
        category: 'Consistency',
        appliesTo: 'dataset',
        failedDatasets: consistencyFailures,
        status: ruleStatusFromFailures(consistencyFailures, totalDatasets),
        guidance: 'Normalize casing, date formats, and canonical value sets during transformation.',
      },
      {
        id: 'rule-uniqueness-threshold',
        name: 'Duplicate Row Rate <= 2%',
        description:
          'Detects duplicate record growth and low uniqueness to protect reporting and entity resolution.',
        category: 'Uniqueness',
        appliesTo: 'dataset',
        failedDatasets: uniquenessFailures,
        status: ruleStatusFromFailures(uniquenessFailures, totalDatasets),
        guidance: 'Introduce deterministic deduplication keys and merge survivorship logic.',
      },
      {
        id: 'rule-relationship-integrity',
        name: 'Cross-Table Referential Integrity',
        description:
          'Evaluates inferred PK/FK links and cross-field checks to detect orphaned or incompatible values.',
        category: 'Relationship',
        appliesTo: 'cross_table',
        failedDatasets: relationshipFailedDatasets,
        status: ruleStatusFromFailures(relationshipFailedDatasets, totalDatasets),
        guidance: 'Add FK validation jobs and reconcile orphaned records before publishing.',
      },
      {
        id: 'rule-timeliness-threshold',
        name: 'Update Delay <= 24 Hours',
        description:
          'Tracks latency from source refresh to profile availability to support near-real-time decisions.',
        category: 'Timeliness',
        appliesTo: 'dataset',
        failedDatasets: timelinessFailures,
        status: ruleStatusFromFailures(timelinessFailures, totalDatasets),
        guidance: 'Move to event-based ingestion or reduce batch cycle intervals.',
      },
    ];
  }, [datasetProfiles, profilingResult.relationships.crossChecks, profilingResult.relationships.inferredForeignKeys]);

  const metadataQualityInsights = useMemo(() => {
    const scoreByDataset = new Map(
      profilingResult.visualization.trustScores.map((score) => [score.datasetId, score])
    );
    return profilingResult.metadata.datasets.map((dataset) => {
      const quality = scoreByDataset.get(dataset.datasetId);
      const qualityScore = quality?.qualityScore || 0;
      const tableHealthScore = quality?.tableHealthScore || 0;
      const discoverabilityScore =
        (dataset.metadataCompletenessPct + qualityScore + tableHealthScore) / 3;
      return {
        ...dataset,
        qualityScore,
        tableHealthScore,
        discoverabilityScore,
      };
    });
  }, [profilingResult.metadata.datasets, profilingResult.visualization.trustScores]);

  const runProfiling = () => {
    const parsedCustomSize = Math.max(1, Math.floor(Number(customSampleSize) || 5000));
    setAppliedOptions({
      focusedDatasetId: focusedDatasetId || undefined,
      samplingMode,
      customSampleSize: samplingMode === 'custom' ? parsedCustomSize : undefined,
    });
    setRunVersion((previous) => previous + 1);
    setLastRunAt(new Date().toISOString());
  };

  const updateRemediationOverride = (
    itemId: string,
    update: Partial<RemediationOverride>
  ) => {
    setRemediationOverrides((previous) => {
      const current = previous[itemId] || {
        status: 'open',
        owner: '',
        note: '',
      };
      return {
        ...previous,
        [itemId]: {
          ...current,
          ...update,
        },
      };
    });
  };

  const exportProfilingJson = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(
      `${fileSafeSegment(workspace.name)}-data-profiling-${timestamp}.json`,
      JSON.stringify({ ...profilingResult, remediationItems }, null, 2),
      'application/json'
    );
  };

  const exportRemediationCsv = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(
      `${fileSafeSegment(workspace.name)}-profiling-remediation-${timestamp}.csv`,
      buildRemediationCsv(profilingResult, remediationOverrides),
      'text/csv'
    );
  };

  const toggleSection = (sectionId: SectionId) => {
    setCollapsedSections((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId],
    }));
  };

  const renderSection = (
    sectionId: SectionId,
    subtitle: string,
    content: ReactNode
  ) => {
    const collapsed = collapsedSections[sectionId];
    return (
      <div className="rounded-lg border border-slate-700/70 bg-slate-900/50">
        <button
          onClick={() => toggleSection(sectionId)}
          className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left"
        >
          <div>
            <p className="text-sm font-medium text-slate-100">{SECTION_TITLES[sectionId]}</p>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <span className="text-slate-300 mt-1">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>
        {!collapsed && <div className="px-4 pb-4 space-y-4">{content}</div>}
      </div>
    );
  };

  if (workspace.datasets.length === 0) {
    return (
      <div className="text-slate-400 text-sm py-8 text-center">
        Import at least one dataset in Workbench to run Data Profiling.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-100">Profiling Run Controls</p>
            <p className="text-xs text-slate-400">
              Last run: {formatDateTime(lastRunAt)} · Generated: {formatDateTime(profilingResult.generatedAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runProfiling}
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 text-xs flex items-center gap-1"
            >
              <Play className="w-3 h-3" />
              Run Profiling
            </button>
            <button
              onClick={exportProfilingJson}
              className="px-3 py-2 rounded bg-emerald-700 text-white hover:bg-emerald-600 text-xs flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Export Profile JSON
            </button>
            <button
              onClick={exportRemediationCsv}
              className="px-3 py-2 rounded bg-emerald-800 text-white hover:bg-emerald-700 text-xs flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Export Remediation CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={focusedDatasetId}
            onChange={(event) => setFocusedDatasetId(event.target.value)}
            className="input-field"
          >
            <option value="">Auto focus (active/first dataset)</option>
            {workspace.datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </select>
          <select
            value={samplingMode}
            onChange={(event) => setSamplingMode(event.target.value as ProfilingSamplingMode)}
            className="input-field"
          >
            <option value="auto">Sampling: Auto</option>
            <option value="full">Sampling: Full Dataset</option>
            <option value="custom">Sampling: Custom Row Count</option>
          </select>
          <input
            type="number"
            min={1}
            step={500}
            value={customSampleSize}
            onChange={(event) => setCustomSampleSize(event.target.value)}
            className="input-field"
            disabled={samplingMode !== 'custom'}
            placeholder="Custom sample rows"
          />
          <button
            onClick={() => setCollapsedSections(DEFAULT_COLLAPSED_SECTIONS)}
            className="px-3 py-2 rounded bg-slate-800 text-slate-100 hover:bg-slate-700 text-xs flex items-center justify-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Collapse Sections
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
            <p className="text-[11px] text-slate-400 uppercase">Datasets</p>
            <p className="text-lg font-semibold text-slate-100">{formatNumber(profilingResult.totalDatasets)}</p>
          </div>
          <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
            <p className="text-[11px] text-slate-400 uppercase">Rows Profiled</p>
            <p className="text-lg font-semibold text-slate-100">{formatNumber(profilingResult.sampledRows)}</p>
          </div>
          <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
            <p className="text-[11px] text-slate-400 uppercase">Sampling Ratio</p>
            <p className="text-lg font-semibold text-slate-100">
              {formatPct(profilingResult.automation.samplingRatioPct)}
            </p>
          </div>
          <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
            <p className="text-[11px] text-slate-400 uppercase">Anomalies</p>
            <p className="text-lg font-semibold text-slate-100">{formatNumber(profilingResult.content.anomalies.length)}</p>
          </div>
          <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
            <p className="text-[11px] text-slate-400 uppercase">Outliers</p>
            <p className="text-lg font-semibold text-slate-100">{formatNumber(totalOutliers)}</p>
          </div>
          <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
            <p className="text-[11px] text-slate-400 uppercase">Remediation</p>
            <p className="text-lg font-semibold text-slate-100">
              {remediationCounts.open}/{remediationCounts.in_progress}/{remediationCounts.resolved}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-100">Profiling Techniques Coverage</p>
          <p className="text-xs text-slate-400">
            Structure/content/relationship/metadata discovery with field and multi-field profiling support.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {profilingTechniqueCards.map((item) => (
            <div
              key={item.title}
              className="rounded border border-slate-700/70 bg-slate-950/40 p-3"
            >
              <p className="text-xs uppercase text-slate-400">{item.title}</p>
              <p className="text-xs text-slate-200 mt-1">{item.description}</p>
              <p className="text-xs text-cyan-300 mt-2">{item.metric}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
            <p className="text-xs uppercase text-slate-400">Data Profiling Workflow Stages</p>
            {workflowStages.map((item) => (
              <div key={item.stage} className="rounded border border-slate-700/50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-200">{item.stage}</p>
                  <span className={`px-2 py-1 rounded text-[11px] ${stageStatusClasses(item.status)}`}>
                    {item.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
            <p className="text-xs uppercase text-slate-400">Common Profiling Functions</p>
            {PROFILING_FUNCTIONS.map((item) => (
              <div key={item.category} className="rounded border border-slate-700/50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-200">{item.category}</p>
                  <p className="text-[11px] text-slate-500">{item.examples}</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {renderSection(
        'structural',
        'Data type inference, schema checks, and format compliance.',
        <>
          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Dataset</th>
                  <th className="text-left p-2">Rows</th>
                  <th className="text-left p-2">Sampled</th>
                  <th className="text-left p-2">Columns</th>
                  <th className="text-left p-2">Nullable Columns</th>
                  <th className="text-left p-2">Type Mismatch Cols</th>
                  <th className="text-left p-2">Format Violation Cols</th>
                  <th className="text-left p-2">Max Field Length</th>
                </tr>
              </thead>
              <tbody>
                {profilingResult.structural.datasets.map((item) => (
                  <tr key={item.datasetId} className="border-t border-slate-700/60 text-slate-200">
                    <td className="p-2">
                      <p>{item.datasetName}</p>
                      <p className="text-[11px] text-slate-400">
                        {Object.entries(item.inferredTypes)
                          .map(([type, count]) => `${type}:${count}`)
                          .join(' · ')}
                      </p>
                    </td>
                    <td className="p-2">{formatNumber(item.rowCount)}</td>
                    <td className="p-2">{formatNumber(item.sampledRows)}</td>
                    <td className="p-2">{formatNumber(item.columnCount)}</td>
                    <td className="p-2">{formatNumber(item.nullableColumns)}</td>
                    <td className="p-2">{formatNumber(item.typeMismatchColumns)}</td>
                    <td className="p-2">{formatNumber(item.formatViolationColumns)}</td>
                    <td className="p-2">{formatNumber(item.maxFieldLength)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Dataset</th>
                  <th className="text-left p-2">Column</th>
                  <th className="text-left p-2">Pattern</th>
                  <th className="text-left p-2">Valid</th>
                  <th className="text-left p-2">Invalid</th>
                  <th className="text-left p-2">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {profilingResult.structural.patternChecks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-3 text-slate-400">
                      No email/phone/postal pattern columns detected in sampled data.
                    </td>
                  </tr>
                ) : (
                  profilingResult.structural.patternChecks.map((check) => (
                    <tr
                      key={`${check.datasetId}-${check.column}-${check.patternType}`}
                      className="border-t border-slate-700/60 text-slate-200"
                    >
                      <td className="p-2">{check.datasetName}</td>
                      <td className="p-2">{check.column}</td>
                      <td className="p-2 uppercase">{check.patternType}</td>
                      <td className="p-2">{formatNumber(check.validCount)}</td>
                      <td className="p-2">{formatNumber(check.invalidCount)}</td>
                      <td className="p-2">{formatPct(check.compliancePct)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
            <p className="text-xs uppercase text-slate-400">
              Automated Column Profiling (Field-Level Patterns, Frequency, Anomalies)
            </p>
            <div className="overflow-auto">
              <table className="min-w-[980px] w-full text-xs">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="text-left p-2">Dataset</th>
                    <th className="text-left p-2">Column</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Pattern</th>
                    <th className="text-left p-2">Non-Null</th>
                    <th className="text-left p-2">Distinct</th>
                    <th className="text-left p-2">Top Values</th>
                    <th className="text-left p-2">Anomalies</th>
                  </tr>
                </thead>
                <tbody>
                  {automatedColumnProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-3 text-slate-400">
                        No column-level profile points available.
                      </td>
                    </tr>
                  ) : (
                    automatedColumnProfiles.slice(0, 240).map((item) => (
                      <tr
                        key={`${item.datasetId}-${item.column}`}
                        className="border-t border-slate-700/60 text-slate-200 align-top"
                      >
                        <td className="p-2">{item.datasetName}</td>
                        <td className="p-2">{item.column}</td>
                        <td className="p-2">{item.inferredType}</td>
                        <td className="p-2">{item.pattern}</td>
                        <td className="p-2">{formatNumber(item.nonNullCount)}</td>
                        <td className="p-2">{formatNumber(item.distinctCount)}</td>
                        <td className="p-2 text-[11px] text-slate-300">
                          {item.topValues.length === 0
                            ? 'No values'
                            : item.topValues
                              .slice(0, 3)
                              .map((entry) => `${entry.value} (${entry.count})`)
                              .join(', ')}
                        </td>
                        <td className="p-2 text-[11px] text-slate-300">
                          {item.anomalyFlags.length === 0
                            ? 'None'
                            : item.anomalyFlags.slice(0, 3).join(' · ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {renderSection(
        'content',
        'Descriptive statistics, null/blank checks, uniqueness, and anomaly detection.',
        <>
          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Column</th>
                  <th className="text-left p-2">Min</th>
                  <th className="text-left p-2">Max</th>
                  <th className="text-left p-2">Mean</th>
                  <th className="text-left p-2">Median</th>
                  <th className="text-left p-2">Mode</th>
                  <th className="text-left p-2">Std Dev</th>
                  <th className="text-left p-2">Outliers</th>
                </tr>
              </thead>
              <tbody>
                {profilingResult.content.descriptiveStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-3 text-slate-400">
                      No numeric columns available for descriptive statistics in the focused dataset sample.
                    </td>
                  </tr>
                ) : (
                  profilingResult.content.descriptiveStats.map((stat) => (
                    <tr key={stat.column} className="border-t border-slate-700/60 text-slate-200">
                      <td className="p-2">{stat.column}</td>
                      <td className="p-2">{stat.min.toFixed(3)}</td>
                      <td className="p-2">{stat.max.toFixed(3)}</td>
                      <td className="p-2">{stat.mean.toFixed(3)}</td>
                      <td className="p-2">{stat.median.toFixed(3)}</td>
                      <td className="p-2">{stat.mode.toFixed(3)}</td>
                      <td className="p-2">{stat.stdDev.toFixed(3)}</td>
                      <td className="p-2">
                        {formatNumber(stat.outlierCount)} ({formatPct(stat.outlierPct)})
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Column</th>
                  <th className="text-left p-2">Distinct</th>
                  <th className="text-left p-2">Uniqueness</th>
                  <th className="text-left p-2">Null Count</th>
                  <th className="text-left p-2">Completeness</th>
                  <th className="text-left p-2">Validity</th>
                </tr>
              </thead>
              <tbody>
                {profilingResult.content.distinctAndNullStats.map((stat) => (
                  <tr key={stat.column} className="border-t border-slate-700/60 text-slate-200">
                    <td className="p-2">{stat.column}</td>
                    <td className="p-2">{formatNumber(stat.distinctCount)}</td>
                    <td className="p-2">{formatPct(stat.uniquenessPct)}</td>
                    <td className="p-2">{formatNumber(stat.nullCount)}</td>
                    <td className="p-2">{formatPct(stat.completenessPct)}</td>
                    <td className="p-2">{formatPct(stat.validityPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Anomalies & Outliers</p>
            {profilingResult.content.anomalies.length === 0 ? (
              <p className="text-xs text-emerald-300">No high-confidence anomalies detected in sampled data.</p>
            ) : (
              profilingResult.content.anomalies.map((anomaly, index) => (
                <div
                  key={`anomaly-${index}`}
                  className={`rounded px-3 py-2 text-xs ${severityClasses(anomaly.severity)}`}
                >
                  <p className="font-medium">{anomaly.type}</p>
                  <p className="mt-1">{anomaly.message}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {renderSection(
        'relationships',
        'Primary/foreign key discovery, cross-column checks, and lineage coverage.',
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Lineage Nodes</p>
              <p className="text-xl font-semibold text-slate-100">
                {formatNumber(profilingResult.relationships.lineage.nodeCount)}
              </p>
            </div>
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Lineage Edges</p>
              <p className="text-xl font-semibold text-slate-100">
                {formatNumber(profilingResult.relationships.lineage.edgeCount)}
              </p>
            </div>
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Inferred FK Edges</p>
              <p className="text-xl font-semibold text-slate-100">
                {formatNumber(profilingResult.relationships.lineage.inferredFkEdges)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Candidate Keys</p>
            {profilingResult.relationships.candidateKeys.map((item) => (
              <div
                key={item.datasetId}
                className="rounded border border-slate-700/70 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"
              >
                <p className="font-medium">{item.datasetName}</p>
                <p className="text-slate-400 mt-1">
                  {item.columns.length > 0 ? item.columns.join(', ') : 'No candidate key detected'}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Source</th>
                  <th className="text-left p-2">Target</th>
                  <th className="text-left p-2">Overlap</th>
                  <th className="text-left p-2">Orphans</th>
                </tr>
              </thead>
              <tbody>
                {profilingResult.relationships.inferredForeignKeys.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-slate-400">
                      No inferred foreign keys detected above confidence threshold.
                    </td>
                  </tr>
                ) : (
                  profilingResult.relationships.inferredForeignKeys.map((fk) => (
                    <tr
                      key={`${fk.sourceDatasetId}-${fk.sourceColumn}-${fk.targetDatasetId}-${fk.targetColumn}`}
                      className="border-t border-slate-700/60 text-slate-200"
                    >
                      <td className="p-2">
                        {fk.sourceDatasetName}.{fk.sourceColumn}
                      </td>
                      <td className="p-2">
                        {fk.targetDatasetName}.{fk.targetColumn}
                      </td>
                      <td className="p-2">{formatPct(fk.overlapPct)}</td>
                      <td className="p-2">{formatNumber(fk.orphanCount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Dataset</th>
                  <th className="text-left p-2">Rule</th>
                  <th className="text-left p-2">Issues</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {profilingResult.relationships.crossChecks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-slate-400">
                      No cross-column/cross-table validation rules inferred from dataset schema.
                    </td>
                  </tr>
                ) : (
                  profilingResult.relationships.crossChecks.map((check) => (
                    <tr key={`${check.datasetId}-${check.rule}`} className="border-t border-slate-700/60 text-slate-200">
                      <td className="p-2">{check.datasetName}</td>
                      <td className="p-2">{check.rule}</td>
                      <td className="p-2">{formatNumber(check.issueCount)}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-1 rounded text-[11px] ${check.status === 'pass'
                            ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/30'
                            : 'bg-amber-600/20 text-amber-200 border border-amber-500/30'
                            }`}
                        >
                          {check.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2">{check.note}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {onOpenKnowledgeGraph && (
            <button
              onClick={onOpenKnowledgeGraph}
              className="px-3 py-2 rounded bg-slate-800 text-slate-100 hover:bg-slate-700 text-xs inline-flex items-center gap-1"
            >
              <Network className="w-3 h-3" />
              Open Knowledge Graph Tab
            </button>
          )}
        </>
      )}

      {renderSection(
        'metadata',
        'Capture ownership, refresh frequency, business definitions, and sensitive-data tags.',
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Sensitive Datasets</p>
              <p className="text-xl font-semibold text-slate-100">
                {formatNumber(profilingResult.metadata.piiSummary.sensitiveDatasets)}
              </p>
            </div>
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">PII/PCI Tagged Columns</p>
              <p className="text-xl font-semibold text-slate-100">
                {formatNumber(profilingResult.metadata.piiSummary.piiColumns)}
              </p>
            </div>
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Tag Types</p>
              <p className="text-xl font-semibold text-slate-100">
                {formatNumber(Object.keys(profilingResult.metadata.piiSummary.byTag).length)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(profilingResult.metadata.piiSummary.byTag).map(([tag, count]) => (
              <span
                key={tag}
                className="px-2 py-1 rounded bg-cyan-600/20 text-cyan-100 border border-cyan-500/30 text-xs"
              >
                {tag}: {count}
              </span>
            ))}
          </div>

          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Dataset</th>
                  <th className="text-left p-2">Owner</th>
                  <th className="text-left p-2">Imported</th>
                  <th className="text-left p-2">Update Frequency</th>
                  <th className="text-left p-2">Business Definition</th>
                  <th className="text-left p-2">Tags</th>
                  <th className="text-left p-2">Metadata Completeness</th>
                </tr>
              </thead>
              <tbody>
                {profilingResult.metadata.datasets.map((item) => (
                  <tr key={item.datasetId} className="border-t border-slate-700/60 text-slate-200">
                    <td className="p-2">{item.datasetName}</td>
                    <td className="p-2">{item.owner}</td>
                    <td className="p-2">{formatDateTime(item.importedAt)}</td>
                    <td className="p-2">{item.updateFrequency}</td>
                    <td className="p-2">{item.businessDefinition}</td>
                    <td className="p-2">
                      {item.sensitivityTags.length > 0 ? item.sensitivityTags.join(', ') : 'None'}
                    </td>
                    <td className="p-2">{formatPct(item.metadataCompletenessPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
            <p className="text-xs uppercase text-slate-400">
              Metadata-Driven Quality Insights (Catalog Context + Trust)
            </p>
            <div className="overflow-auto">
              <table className="min-w-[860px] w-full text-xs">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="text-left p-2">Dataset</th>
                    <th className="text-left p-2">Business Definition</th>
                    <th className="text-left p-2">Metadata Completeness</th>
                    <th className="text-left p-2">Quality Score</th>
                    <th className="text-left p-2">Table Health</th>
                    <th className="text-left p-2">Discoverability</th>
                  </tr>
                </thead>
                <tbody>
                  {metadataQualityInsights.map((item) => (
                    <tr key={`${item.datasetId}-insight`} className="border-t border-slate-700/60 text-slate-200">
                      <td className="p-2">{item.datasetName}</td>
                      <td className="p-2">{item.businessDefinition}</td>
                      <td className="p-2">{formatPct(item.metadataCompletenessPct)}</td>
                      <td className="p-2">{item.qualityScore.toFixed(1)}%</td>
                      <td className="p-2">{item.tableHealthScore.toFixed(1)}%</td>
                      <td className="p-2">{item.discoverabilityScore.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {renderSection(
        'classification',
        'Data Classification (PII/PHI Detection) - Identify and classify sensitive business and personal data attributes based on predefined compliance standards.',
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 h-[600px]">
            {/* Sidebar for Predefined Functions */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col pt-1">
              <p className="text-xs uppercase text-slate-400 mb-2 font-semibold">Predefined Functions</p>
              <div className="space-y-1 overflow-auto flex-1 pr-1">
                {PREDEFINED_CLASSIFICATIONS.map(cls => (
                  <button
                    key={cls.id}
                    onClick={() => setActiveClassification(cls.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border flex flex-col gap-0.5 transition-colors ${activeClassification === cls.id
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-100'
                      : 'bg-slate-900/40 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                      }`}
                  >
                    <span className="text-sm font-semibold">{cls.name}</span>
                    <span className="text-[10px] text-slate-400 truncate">{cls.desc}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 rounded border border-slate-700/50 bg-slate-900/40 text-xs text-slate-400">
                <p className="mb-2"><span className="text-cyan-400 font-medium">Auto-Discovery:</span> Algorithm scans catalog objects matching <span className="bg-slate-800 px-1 rounded">name</span>, <span className="bg-slate-800 px-1 rounded">title</span>, or <span className="bg-slate-800 px-1 rounded">description</span>.</p>
                <p className="mb-2">Finds columns matching already assigned classifications or linked to business glossary terms.</p>
                <p className="text-[10px] text-amber-300/80 italic">Propagates to similar columns on next run. Curate manually if needed.</p>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-900/40 border border-slate-700/50 rounded-lg overflow-hidden">
              {/* Toolbar */}
              <div className="p-3 border-b border-slate-700/50 bg-slate-800/50 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <div className="relative flex-1 max-w-xs">
                    <select
                      value={classificationDatasetId}
                      onChange={(e) => setClassificationDatasetId(e.target.value)}
                      className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-3 pr-8 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">All Datasets (Entire Catalog)</option>
                      {workspace.datasets.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2 text-slate-500 w-3.5 h-3.5 pointer-events-none" />
                  </div>
                  <button
                    onClick={runClassification}
                    disabled={isClassifying}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs rounded-md font-medium flex items-center gap-1.5 transition-colors"
                  >
                    {isClassifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    {isClassifying ? 'Scanning...' : 'Run Classification'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-slate-900 rounded-md flex border border-slate-700 p-0.5">
                    <button
                      onClick={() => setClassificationViewMode('table')}
                      className={`p-1 rounded flex items-center gap-1 text-[10px] ${classificationViewMode === 'table' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Table Structure View"
                    >
                      <Database className="w-3.5 h-3.5" /> Table
                    </button>
                    <button
                      onClick={() => setClassificationViewMode('column')}
                      className={`p-1 rounded flex items-center gap-1 text-[10px] ${classificationViewMode === 'column' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
                      title="Column Structure View"
                    >
                      <TableColumnsSplit className="w-3.5 h-3.5" /> Column
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Search to narrow context..."
                    value={classificationSearch}
                    onChange={e => setClassificationSearch(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 w-48 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-auto p-0">
                {!classificationResults ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
                    <FileSearch className="w-12 h-12 opacity-20" />
                    <p className="text-sm">Select a compliance function and scope, then run classification.</p>
                    <p className="text-xs text-slate-600 max-w-sm text-center">It scans the data catalog and finds matching objects based on masks, glossary links, and previously classified similar columns.</p>
                  </div>
                ) : (
                  <table className="min-w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-slate-800/80 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50 w-8 text-center">
                          <input type="checkbox" className="rounded bg-slate-900 border-slate-600" />
                        </th>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50">{classificationViewMode === 'table' ? 'Dataset' : 'Column Name'}</th>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50">{classificationViewMode === 'table' ? 'Column' : 'Found in Dataset'}</th>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50">Current Value</th>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50 bg-blue-900/10 text-blue-200">Update to (Suggested)</th>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50 bg-blue-900/10 text-blue-200">Suggested Domain</th>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50">Match By</th>
                        <th className="p-2.5 font-medium text-slate-300 border-b border-slate-700/50 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {filteredClassificationResults?.length === 0 ? (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-500">No columns matched the classification functions and search criteria.</td></tr>
                      ) : (
                        filteredClassificationResults?.map((res, i) => (
                          <tr key={res.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="p-2 border-r border-slate-800 text-center"><input type="checkbox" className="rounded bg-slate-900 border-slate-600" /></td>
                            <td className="p-2 font-medium text-slate-300">{classificationViewMode === 'table' ? res.datasetName : res.columnName}</td>
                            <td className="p-2 text-slate-400">{classificationViewMode === 'table' ? res.columnName : res.datasetName}</td>
                            <td className="p-2 text-slate-500">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">{res.currentClassification}</span>
                            </td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded bg-blue-900/40 border border-blue-500/30 text-blue-300 text-[10px] whitespace-nowrap flex items-center w-fit gap-1">
                                <Shield className="w-2.5 h-2.5" />
                                {res.suggestedClassification}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded bg-purple-900/30 border border-purple-500/30 text-purple-300 text-[10px] whitespace-nowrap flex items-center w-fit gap-1">
                                <BookKey className="w-2.5 h-2.5" />
                                {res.suggestedDomain}
                              </span>
                            </td>
                            <td className="p-2 text-[10px] text-slate-500">{res.matchType}</td>
                            <td className="p-2 text-center text-slate-500 group-hover:text-slate-300 cursor-pointer">
                              <Settings2 className="w-3.5 h-3.5 mx-auto" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              {classificationResults && (
                <div className="p-3 border-t border-slate-700/50 bg-slate-800/80 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    {filteredClassificationResults?.length || 0} columns suggested for classification. Run multiple times to propagate labels.
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[11px] rounded-md transition-colors">Curate Manually</button>
                    <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium rounded-md flex items-center gap-1.5 transition-colors">
                      <Save className="w-3.5 h-3.5" /> Save Classifications
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {renderSection(
        'automation',
        'Run profile jobs at scale using scheduling, pushdown opportunities, and sampling strategies.',
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Recommended Schedule</p>
              <p className="text-sm font-semibold text-slate-100 mt-1">
                {profilingResult.automation.recommendedSchedule}
              </p>
            </div>
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Pushdown Eligible</p>
              <p className="text-sm font-semibold text-slate-100 mt-1">
                {formatNumber(profilingResult.automation.pushdownEligibleDatasets)} datasets
              </p>
            </div>
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Pushdown Coverage</p>
              <p className="text-sm font-semibold text-slate-100 mt-1">
                {formatPct(profilingResult.automation.pushdownCoveragePct)}
              </p>
            </div>
            <div className="p-3 rounded bg-slate-800/60 border border-slate-700/70">
              <p className="text-[11px] text-slate-400 uppercase">Estimated Duration</p>
              <p className="text-sm font-semibold text-slate-100 mt-1">
                {profilingResult.automation.estimatedProfileDurationSeconds.toFixed(1)}s
              </p>
            </div>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3">
            <p className="text-xs text-slate-300">
              Sampling mode applied: <span className="font-medium">{profilingResult.automation.samplingMode}</span>
            </p>
            <div className="mt-2 space-y-1">
              {profilingResult.automation.notes.map((note, index) => (
                <p key={`auto-note-${index}`} className="text-xs text-slate-400">
                  {index + 1}. {note}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
            <p className="text-xs uppercase text-slate-400">
              Reusable Data Quality Rules Library (Validation + Continuous Monitoring)
            </p>
            <div className="overflow-auto">
              <table className="min-w-[900px] w-full text-xs">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="text-left p-2">Rule</th>
                    <th className="text-left p-2">Category</th>
                    <th className="text-left p-2">Applies To</th>
                    <th className="text-left p-2">Failed Datasets</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {reusableRules.map((rule) => (
                    <tr key={rule.id} className="border-t border-slate-700/60 text-slate-200 align-top">
                      <td className="p-2">
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{rule.description}</p>
                      </td>
                      <td className="p-2">{rule.category}</td>
                      <td className="p-2">{rule.appliesTo}</td>
                      <td className="p-2">{formatNumber(rule.failedDatasets)}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-[11px] ${ruleStatusClasses(rule.status)}`}>
                          {rule.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2">{rule.guidance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {renderSection(
        'visualization',
        'Interactive quality scorecards, histograms, correlations, and export-ready profiling views.',
        <>
          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Trust Scorecards</p>
            {profilingResult.visualization.trustScores.map((score) => (
              <div
                key={score.datasetId}
                className="rounded border border-slate-700/70 bg-slate-950/40 px-3 py-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-200">
                  <span>{score.datasetName}</span>
                  <span>
                    Quality {score.qualityScore.toFixed(1)}% · Table Health {score.tableHealthScore.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.max(0, Math.min(100, score.qualityScore))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase text-slate-400">Distribution Histograms</p>
            {profilingResult.visualization.histograms.length === 0 ? (
              <p className="text-xs text-slate-500">No numeric histogram candidates found.</p>
            ) : (
              profilingResult.visualization.histograms.map((histogram) => {
                const maxBinCount = Math.max(
                  1,
                  ...histogram.bins.map((bin) => bin.count)
                );
                return (
                  <div
                    key={histogram.column}
                    className="rounded border border-slate-700/70 bg-slate-950/40 p-3"
                  >
                    <p className="text-xs text-slate-200 mb-2">{histogram.column}</p>
                    <div className="space-y-1">
                      {histogram.bins.map((bin, index) => (
                        <div key={`${histogram.column}-${index}`} className="flex items-center gap-2">
                          <span className="w-36 text-[11px] text-slate-500 shrink-0 truncate">{bin.label}</span>
                          <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-cyan-500"
                              style={{ width: `${(bin.count / maxBinCount) * 100}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-[11px] text-slate-300">
                            {bin.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="overflow-auto rounded border border-slate-700/70">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-2">Correlation</th>
                  {profilingResult.visualization.correlations.columns.map((column) => (
                    <th key={`corr-head-${column}`} className="text-left p-2">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profilingResult.visualization.correlations.columns.length === 0 ? (
                  <tr>
                    <td colSpan={1} className="p-3 text-slate-400">
                      Not enough numeric columns for correlation matrix.
                    </td>
                  </tr>
                ) : (
                  profilingResult.visualization.correlations.matrix.map((row, rowIndex) => (
                    <tr
                      key={`corr-row-${rowIndex}`}
                      className="border-t border-slate-700/60 text-slate-200"
                    >
                      <td className="p-2">{profilingResult.visualization.correlations.columns[rowIndex]}</td>
                      {row.map((value, columnIndex) => (
                        <td key={`corr-${rowIndex}-${columnIndex}`} className="p-2">
                          {value.toFixed(3)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {renderSection(
        'integration',
        'Pipeline integration signals, issue tracking, and team remediation workflow.',
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3">
              <p className="text-xs uppercase text-slate-400 mb-2">ETL / Pipeline Signals</p>
              <div className="space-y-1">
                {profilingResult.integration.etlIntegrationSignals.map((signal, index) => (
                  <p key={`etl-signal-${index}`} className="text-xs text-slate-200">
                    {index + 1}. {signal}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3">
              <p className="text-xs uppercase text-slate-400 mb-2">Warnings</p>
              {profilingResult.integration.warningSignals.length === 0 ? (
                <p className="text-xs text-emerald-300">No elevated warning signals detected.</p>
              ) : (
                <div className="space-y-1">
                  {profilingResult.integration.warningSignals.map((signal, index) => (
                    <p key={`warning-${index}`} className="text-xs text-amber-200">
                      {index + 1}. {signal}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3">
            <p className="text-xs uppercase text-slate-400">Integrated Stewardship Workflows</p>
            <p className="text-xs text-slate-300 mt-2">
              Profiling findings are linked with quality dashboards, task ownership, and remediation notes so data stewards can curate datasets proactively.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
              <div className="rounded border border-slate-700/60 bg-slate-900/40 p-2">
                <p className="text-[11px] text-slate-400 uppercase">Open Tasks</p>
                <p className="text-sm font-semibold text-slate-100">{formatNumber(remediationCounts.open)}</p>
              </div>
              <div className="rounded border border-slate-700/60 bg-slate-900/40 p-2">
                <p className="text-[11px] text-slate-400 uppercase">In Progress</p>
                <p className="text-sm font-semibold text-slate-100">{formatNumber(remediationCounts.in_progress)}</p>
              </div>
              <div className="rounded border border-slate-700/60 bg-slate-900/40 p-2">
                <p className="text-[11px] text-slate-400 uppercase">Resolved</p>
                <p className="text-sm font-semibold text-slate-100">{formatNumber(remediationCounts.resolved)}</p>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase text-slate-400">
                Collaboration Remediation Tracker ({remediationItems.length})
              </p>
              <p className="text-xs text-slate-500">
                Open {remediationCounts.open} · In Progress {remediationCounts.in_progress} · Resolved {remediationCounts.resolved}
              </p>
            </div>
            <div className="overflow-auto">
              <table className="min-w-[980px] w-full text-xs">
                <thead className="bg-slate-800 text-slate-300">
                  <tr>
                    <th className="text-left p-2">Dataset</th>
                    <th className="text-left p-2">Issue</th>
                    <th className="text-left p-2">Severity</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Owner</th>
                    <th className="text-left p-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {remediationItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-3 text-slate-400">
                        No remediation items generated for the current profiling scope.
                      </td>
                    </tr>
                  ) : (
                    remediationItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-700/60 text-slate-200 align-top">
                        <td className="p-2">{item.datasetName}</td>
                        <td className="p-2">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-slate-400 mt-1">{item.detail}</p>
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-[11px] ${severityClasses(item.severity)}`}>
                            {item.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2">
                          <select
                            value={item.status}
                            onChange={(event) =>
                              updateRemediationOverride(item.id, {
                                status: event.target.value as ProfilingRemediationItem['status'],
                              })
                            }
                            className="input-field py-1 px-2 text-xs"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.owner || ''}
                            onChange={(event) =>
                              updateRemediationOverride(item.id, { owner: event.target.value })
                            }
                            className="input-field py-1 px-2 text-xs min-w-32"
                            placeholder="Assign owner"
                          />
                        </td>
                        <td className="p-2">
                          <textarea
                            value={item.note || ''}
                            onChange={(event) =>
                              updateRemediationOverride(item.id, { note: event.target.value })
                            }
                            rows={2}
                            className="input-field py-1 px-2 text-xs min-w-48"
                            placeholder="Track remediation notes"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
