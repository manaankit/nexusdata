'use client';

import { MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FolderPlus,
  GripVertical,
  LayoutGrid,
  Link2,
  MessageSquare,
  MoveVertical,
  Network,
  Plus,
  RefreshCw,
  Rows3,
  SendHorizontal,
  Sparkles,
  Spline,
  Table2,
  Upload,
  BookOpen,
} from 'lucide-react';
import {
  buildDatasetProfile,
  buildWorkspaceKpis,
  buildWorkspaceReportCsv,
  buildWorkspaceReportMarkdown,
} from '@/lib/workspace/profile';
import * as XLSX from 'xlsx';
import { buildWorkspaceGraph } from '@/lib/workspace/graph';
import {
  buildHierarchy,
  MaterializedSource,
  materializeWorkspaceView,
  resolveWorkspaceSource,
} from '@/lib/workspace/views';
import {
  DataViewCombineMode,
  DataViewColumn,
  DataViewJoinType,
  DataViewOneToManyMode,
  ImportedDataset,
  ViewJoinTarget,
  Workspace,
  WorkspaceDataView,
  WorkspaceSqlHistoryEntry,
  WorkspaceSqlSnippet,
  WorkspaceSourceType,
  WorkspaceWidgetId,
} from '@/types/workspace';
import WorkspaceKnowledgeGraph from './WorkspaceKnowledgeGraph';
import HierarchyTree from './HierarchyTree';
import WorkspaceProfilingTab from './WorkspaceProfilingTab';
import WorkspaceCatalogTab from './WorkspaceCatalogTab';
import KpiIssueDrilldownModal from './KpiIssueDrilldownModal';

const WORKSPACES_STORAGE_KEY = 'dq_workspace_studio_v2';
const SUPPORTED_ACCEPT =
  '.csv,.xlsx,.xls,.sql,.docx,.pdf,.parquet,.txt,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DEFAULT_WIDGET_LAYOUT: WorkspaceWidgetId[] = [
  'importer',
  'datasets',
  'view_builder',
  'data_viewer',
  'kpi_snapshot',
];
const DEFAULT_WIDGET_HEIGHT = 420;
const MIN_WIDGET_HEIGHT = 260;
const MAX_WIDGET_HEIGHT = 780;
const MAX_SQL_RESULT_ROWS = 5000;
const MAX_SQL_HISTORY = 30;
const MAX_SQL_HISTORY_PREVIEW = 8;
const DEFAULT_SQL_QUERY = 'SELECT * FROM source LIMIT 200';
const DEFAULT_TABLE_PAGE_SIZE = 100;
const TABLE_PAGE_SIZE_OPTIONS = [100, 200, 500, 1000];

type WorkspaceTab = 'workbench' | 'profile' | 'profiling' | 'kpis' | 'graph' | 'report' | 'catalog';
type PreviewMode = 'table' | 'hierarchy';

interface SqlQueryResult {
  columns: string[];
  records: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}

type KpiScope = 'workspace' | 'dataset';
type KpiValueFormat = 'percent' | 'count' | 'currency' | 'ratio' | 'hours';

interface KpiAdviceAction {
  title: string;
  why: string;
  impact: 'high' | 'medium' | 'low';
  steps: string[];
}

interface KpiAdvicePayload {
  summary: string;
  actions: KpiAdviceAction[];
  quickWins: string[];
}

interface KpiHelpMeta {
  title: string;
  description: string;
  importance: string;
}

type AlaSqlTable = {
  data: unknown[];
};

type AlaSqlInstance = {
  (sql: string): unknown;
  tables: Record<string, AlaSqlTable | undefined>;
};

declare global {
  interface Window {
    alasql?: AlaSqlInstance;
  }
}

let alasqlLoaderPromise: Promise<AlaSqlInstance> | null = null;

function getAlaSql(): Promise<AlaSqlInstance> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('AlaSQL is only available in the browser.'));
  }

  if (window.alasql) {
    return Promise.resolve(window.alasql);
  }

  if (alasqlLoaderPromise) {
    return alasqlLoaderPromise;
  }

  alasqlLoaderPromise = new Promise<AlaSqlInstance>((resolve, reject) => {
    const onScriptLoaded = () => {
      if (window.alasql) {
        resolve(window.alasql);
      } else {
        reject(new Error('AlaSQL script loaded but window.alasql is unavailable.'));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-alasql-loader="true"]');
    if (existing) {
      existing.addEventListener('load', onScriptLoaded, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load AlaSQL browser script.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = '/vendor/alasql.min.js';
    script.async = true;
    script.dataset.alasqlLoader = 'true';
    script.addEventListener('load', onScriptLoaded, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load AlaSQL browser script.')),
      { once: true }
    );
    document.head.appendChild(script);
  });

  return alasqlLoaderPromise;
}

const WORKBENCH_WIDGETS: Record<
  WorkspaceWidgetId,
  {
    title: string;
    subtitle: string;
  }
> = {
  importer: {
    title: 'Importer',
    subtitle: 'Upload multiple files and parse supported formats',
  },
  datasets: {
    title: 'Datasets',
    subtitle: 'Manage imported datasets and sheet-level sources',
  },
  view_builder: {
    title: 'View Builder',
    subtitle: 'Create reusable cross-dataset column views',
  },
  data_viewer: {
    title: 'Data Editor',
    subtitle: 'Select, edit, and delete detailed records directly',
  },
  kpi_snapshot: {
    title: 'KPI Snapshot',
    subtitle: 'Monitor quality KPIs for the active workspace',
  },
};

const KPI_HELP: Record<string, KpiHelpMeta> = {
  quality_score: {
    title: 'Quality Score',
    description: 'Composite KPI covering critical quality dimensions.',
    importance:
      'Provides one executive indicator of overall data fitness for analytics and operations.',
  },
  table_health: {
    title: 'Table Health',
    description: 'Aggregate health index for each dataset/table.',
    importance:
      'Helps teams prioritize remediation on the least healthy tables first.',
  },
  accuracy: {
    title: 'Accuracy',
    description: 'Proxy score for correctness against inferred data expectations.',
    importance:
      'Inaccurate data drives wrong decisions, reporting errors, and operational risk.',
  },
  completeness: {
    title: 'Completeness',
    description: 'Share of required fields populated with non-empty values.',
    importance:
      'Missing key fields weakens downstream models, segmentation, and forecasts.',
  },
  consistency: {
    title: 'Consistency',
    description: 'Conformance of values to expected type/structure patterns.',
    importance:
      'Inconsistent formats cause integration breaks and unreliable joins/aggregations.',
  },
  timeliness: {
    title: 'Timeliness',
    description: 'How fresh and recently updated the dataset is.',
    importance:
      'Stale data leads to delayed or incorrect operational and business actions.',
  },
  validity: {
    title: 'Validity',
    description: 'Conformance to business and format constraints (email, date, numeric rules).',
    importance:
      'Invalid values break workflows and decrease trust in data products.',
  },
  duplication: {
    title: 'Duplicate Record Percentage',
    description: 'Portion of rows that are duplicated representations of the same record.',
    importance:
      'Duplicates distort KPIs, increase storage, and degrade entity-level analytics.',
  },
  uniqueness: {
    title: 'Uniqueness',
    description: 'Ability to distinguish records using unique identifiers or high-cardinality keys.',
    importance:
      'Poor uniqueness causes identity collisions and prevents reliable record linkage.',
  },
  lineage: {
    title: 'Lineage',
    description: 'Coverage of source and processing metadata for traceability.',
    importance:
      'Lineage enables root-cause analysis and prevents error propagation downstream.',
  },
  data_to_errors_ratio: {
    title: 'Data to Errors Ratio',
    description: 'Ratio of total data cells to known quality errors.',
    importance:
      'Shows whether quality is improving relative to data volume growth.',
  },
  empty_values: {
    title: 'Number of Empty Values',
    description: 'Total count of blank/null cells in the dataset.',
    importance:
      'Highlights missing critical attributes that reduce usability and modeling quality.',
  },
  transformation_errors: {
    title: 'Data Transformation Errors',
    description: 'Count of warnings/failures detected during data parsing and transformation.',
    importance:
      'Frequent transform errors indicate schema mismatch and pipeline instability.',
  },
  dark_data: {
    title: 'Amount of Dark Data',
    description: 'Share of low-value columns that are incomplete/invalid/rarely useful.',
    importance:
      'Dark data consumes resources without delivering measurable business value.',
  },
  storage_costs: {
    title: 'Data Storage Costs',
    description: 'Estimated monthly storage cost for persisted dataset payloads.',
    importance:
      'Growing cost without value gain indicates inefficient data retention quality.',
  },
  time_to_value: {
    title: 'Data Time-to-Value',
    description: 'Estimated hours to convert newly ingested data into actionable outputs.',
    importance:
      'Lower time-to-value improves responsiveness and ROI from data operations.',
  },
  email_bounce_rates: {
    title: 'Email Bounce Rates',
    description: 'Proxy invalid-email rate derived from email-format quality checks.',
    importance:
      'Poor email quality hurts outreach campaigns, revenue conversion, and sender reputation.',
  },
  cost_of_quality: {
    title: 'Cost of Quality',
    description: 'Estimated remediation effort/cost required to fix known quality defects.',
    importance:
      'Quantifies business impact and helps justify data quality investments.',
  },
  data_update_delays: {
    title: 'Data Update Delays',
    description: 'Average lag between now and latest available dataset updates.',
    importance:
      'High delay means business decisions are made on outdated information.',
  },
  data_pipeline_incidents: {
    title: 'Data Pipeline Incidents',
    description: 'Count of pipeline warning/error signals threatening data integrity.',
    importance:
      'Incident reduction improves reliability of ingestion and transformation layers.',
  },
};

function formatKpiValue(value: number, format: KpiValueFormat): string {
  if (format === 'percent') return `${value.toFixed(1)}%`;
  if (format === 'currency') return `$${value.toFixed(2)}`;
  if (format === 'ratio') return `${value.toFixed(2)}:1`;
  if (format === 'hours') return `${value.toFixed(1)}h`;
  return Intl.NumberFormat('en-US').format(Math.round(value));
}

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function toCsv(dataset: ImportedDataset): string {
  if (dataset.columns.length === 0) return '';
  const header = dataset.columns;
  const rows = dataset.records.map((record) =>
    header.map((column) => {
      const value = record[column];
      if (value === null || value === undefined) return '';
      const text = String(value);
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    })
  );
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

function normalizeWorkspace(raw: any): Workspace {
  const nowIso = new Date().toISOString();
  const datasets = Array.isArray(raw?.datasets) ? raw.datasets : [];
  const views = Array.isArray(raw?.views)
    ? raw.views.map((view: any) => ({
      ...view,
      combineMode: view?.combineMode === 'join_by_key' ? 'join_by_key' : 'row_index',
      columns: Array.isArray(view?.columns) ? view.columns : [],
      joinConfig:
        view?.combineMode === 'join_by_key' && view?.joinConfig
          ? {
            baseDatasetId: String(view.joinConfig.baseDatasetId || ''),
            baseKeyColumn: String(view.joinConfig.baseKeyColumn || ''),
            joinType:
              view.joinConfig.joinType === 'inner' ||
                view.joinConfig.joinType === 'left' ||
                view.joinConfig.joinType === 'full'
                ? view.joinConfig.joinType
                : 'left',
            oneToManyMode:
              view.joinConfig.oneToManyMode === 'first_match' ? 'first_match' : 'expand',
            joins: Array.isArray(view.joinConfig.joins) ? view.joinConfig.joins : [],
          }
          : undefined,
    }))
    : [];
  const widgetLayout = Array.isArray(raw?.widgetLayout) && raw.widgetLayout.length > 0
    ? raw.widgetLayout.filter((item: WorkspaceWidgetId) => DEFAULT_WIDGET_LAYOUT.includes(item))
    : DEFAULT_WIDGET_LAYOUT;
  const missingWidgets = DEFAULT_WIDGET_LAYOUT.filter((item) => !widgetLayout.includes(item));
  const incomingWidgetSizes =
    raw?.widgetSizes && typeof raw.widgetSizes === 'object' ? raw.widgetSizes : {};
  const widgetSizes: Partial<Record<WorkspaceWidgetId, number>> = {};
  const incomingCollapsedWidgets =
    raw?.collapsedWidgets && typeof raw.collapsedWidgets === 'object'
      ? raw.collapsedWidgets
      : {};
  const collapsedWidgets = buildDefaultCollapsedWidgets();
  DEFAULT_WIDGET_LAYOUT.forEach((widgetId) => {
    const value = Number(incomingWidgetSizes[widgetId]);
    if (Number.isFinite(value)) {
      widgetSizes[widgetId] = Math.max(MIN_WIDGET_HEIGHT, Math.min(MAX_WIDGET_HEIGHT, value));
    }

    if (typeof incomingCollapsedWidgets[widgetId] === 'boolean') {
      collapsedWidgets[widgetId] = incomingCollapsedWidgets[widgetId];
    }
  });
  const sqlHistory: WorkspaceSqlHistoryEntry[] = Array.isArray(raw?.sqlHistory)
    ? raw.sqlHistory
      .map((entry: any) => {
        const query = String(entry?.query || '').trim();
        const sourceType: WorkspaceSourceType = entry?.sourceType === 'view' ? 'view' : 'dataset';
        const rowCountNumber = Number(entry?.rowCount);
        return {
          id: typeof entry?.id === 'string' ? entry.id : crypto.randomUUID(),
          query,
          sourceType,
          sourceId: typeof entry?.sourceId === 'string' ? entry.sourceId : undefined,
          sourceName:
            typeof entry?.sourceName === 'string' && entry.sourceName.trim().length > 0
              ? entry.sourceName
              : sourceType === 'view'
                ? 'View'
                : 'Dataset',
          rowCount: Number.isFinite(rowCountNumber) && rowCountNumber >= 0 ? rowCountNumber : 0,
          executedAt: typeof entry?.executedAt === 'string' ? entry.executedAt : nowIso,
        };
      })
      .filter((entry: WorkspaceSqlHistoryEntry) => entry.query.length > 0)
    : [];

  const sqlSnippets: WorkspaceSqlSnippet[] = Array.isArray(raw?.sqlSnippets)
    ? raw.sqlSnippets
      .map((snippet: any) => {
        const query = String(snippet?.query || '').trim();
        const name = String(snippet?.name || '').trim();
        const createdAt = typeof snippet?.createdAt === 'string' ? snippet.createdAt : nowIso;
        return {
          id: typeof snippet?.id === 'string' ? snippet.id : crypto.randomUUID(),
          name,
          query,
          createdAt,
          updatedAt: typeof snippet?.updatedAt === 'string' ? snippet.updatedAt : createdAt,
        };
      })
      .filter(
        (snippet: WorkspaceSqlSnippet) =>
          snippet.name.length > 0 && snippet.query.length > 0
      )
    : [];

  return {
    id: typeof raw?.id === 'string' ? raw.id : crypto.randomUUID(),
    name: typeof raw?.name === 'string' ? raw.name : 'Workspace',
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : nowIso,
    datasets,
    views,
    widgetLayout: [...widgetLayout, ...missingWidgets],
    widgetSizes,
    collapsedWidgets,
    activeDatasetId:
      typeof raw?.activeDatasetId === 'string' ? raw.activeDatasetId : datasets[0]?.id,
    activeViewId:
      typeof raw?.activeViewId === 'string' ? raw.activeViewId : views[0]?.id,
    sqlHistory,
    sqlSnippets,
  };
}

function sourceToDataset(source: {
  id: string;
  name: string;
  rowCount: number;
  columns: string[];
  records: Record<string, unknown>[];
}): ImportedDataset {
  return {
    id: source.id,
    name: source.name,
    fileName: `${source.name}.generated`,
    format: 'json',
    kind: 'tabular',
    rowCount: source.rowCount,
    columns: source.columns,
    records: source.records,
    parseWarnings: [],
    importedAt: new Date().toISOString(),
  };
}

function reorderLayout(
  layout: WorkspaceWidgetId[],
  dragged: WorkspaceWidgetId,
  target: WorkspaceWidgetId
): WorkspaceWidgetId[] {
  if (dragged === target) return layout;
  const withoutDragged = layout.filter((item) => item !== dragged);
  const targetIndex = withoutDragged.indexOf(target);
  if (targetIndex < 0) return layout;
  const next = [...withoutDragged];
  next.splice(targetIndex, 0, dragged);
  return next;
}

function clampWidgetHeight(value: number): number {
  return Math.max(MIN_WIDGET_HEIGHT, Math.min(MAX_WIDGET_HEIGHT, value));
}

function isStorageQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

function toFileSafeSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return normalized.length > 0 ? normalized : 'export';
}

function buildTimestampToken(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function buildDefaultCollapsedWidgets(): Partial<Record<WorkspaceWidgetId, boolean>> {
  const collapsed: Partial<Record<WorkspaceWidgetId, boolean>> = {};
  DEFAULT_WIDGET_LAYOUT.forEach((widgetId) => {
    collapsed[widgetId] = true;
  });
  return collapsed;
}

function normalizeTextValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (value instanceof Date) return value.toISOString().toLowerCase();
  return String(value).trim().toLowerCase();
}

function findMentionedColumn(question: string, columns: string[]): string | undefined {
  const normalizedQuestion = question.toLowerCase();
  return columns.find((column) => normalizedQuestion.includes(column.toLowerCase()));
}

function buildDataChatResponse(question: string, source?: MaterializedSource): string {
  if (!source) {
    return 'Select a dataset or view first, then ask a question about the data.';
  }

  const q = question.trim().toLowerCase();
  if (!q) {
    return 'Ask a question like "how many rows?", "show columns", or "nulls in email".';
  }

  const records = source.records;
  const columns = source.columns;
  const mentionedColumn = findMentionedColumn(q, columns);

  if (/(row count|rows|how many rows|total rows)/.test(q)) {
    return `${source.name} contains ${source.rowCount} rows.`;
  }

  if (/(columns|fields|schema)/.test(q)) {
    if (columns.length === 0) return `${source.name} has no columns.`;
    const preview = columns.slice(0, 25).join(', ');
    const suffix = columns.length > 25 ? ` ... (+${columns.length - 25} more)` : '';
    return `Columns (${columns.length}): ${preview}${suffix}`;
  }

  if (mentionedColumn && /(null|missing|blank|empty)/.test(q)) {
    const nullCount = records.reduce((count, row) => {
      const value = row[mentionedColumn];
      if (value === null || value === undefined) return count + 1;
      if (typeof value === 'string' && value.trim() === '') return count + 1;
      return count;
    }, 0);
    const pct = records.length === 0 ? 0 : (nullCount / records.length) * 100;
    return `${mentionedColumn}: ${nullCount} null/blank values (${pct.toFixed(2)}%).`;
  }

  if (mentionedColumn && /(unique|distinct)/.test(q)) {
    const distinct = new Set(
      records
        .map((row) => row[mentionedColumn])
        .filter((value) => value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === ''))
        .map((value) => normalizeTextValue(value))
    );
    return `${mentionedColumn}: ${distinct.size} distinct non-empty values.`;
  }

  if (mentionedColumn && /(top|most common|frequent)/.test(q)) {
    const frequency = new Map<string, number>();
    records.forEach((row) => {
      const key = normalizeTextValue(row[mentionedColumn]) || '(blank)';
      frequency.set(key, (frequency.get(key) || 0) + 1);
    });
    const top = Array.from(frequency.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([value, count]) => `${value}: ${count}`)
      .join(' | ');
    return top.length > 0
      ? `Top values for ${mentionedColumn}: ${top}`
      : `No values found for ${mentionedColumn}.`;
  }

  if (/(quality|profile|score)/.test(q)) {
    const profile = buildDatasetProfile(sourceToDataset(source));
    return `Quality ${profile.qualityScore.toFixed(1)}%, table health ${profile.tableHealthScore.toFixed(
      1
    )}%. Accuracy ${profile.accuracyPct.toFixed(
      1
    )}%, completeness ${profile.completenessPct.toFixed(1)}%, consistency ${profile.consistencyPct.toFixed(
      1
    )}%, validity ${profile.validityPct.toFixed(1)}%, timeliness ${profile.timelinessPct.toFixed(
      1
    )}%, duplication ${profile.duplicationPct.toFixed(1)}%, uniqueness ${profile.uniquenessPct.toFixed(
      1
    )}%, lineage ${profile.lineagePct.toFixed(1)}%, data-to-errors ${profile.dataToErrorsRatio.toFixed(
      2
    )}:1.`;
  }

  if (/(sample|preview|show rows|example)/.test(q)) {
    const sample = records.slice(0, 5);
    if (sample.length === 0) return 'No rows available to sample.';
    return `Sample rows (first ${sample.length}): ${JSON.stringify(sample, null, 2)}`;
  }

  return `I can help with row counts, columns, null checks, distinct counts, top values, quality summary, and sample rows. Ask about a specific column name for better answers.`;
}

export default function WorkspaceStudio() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('workbench');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [importMaxRecords, setImportMaxRecords] = useState('5000');
  const [importNoLimit, setImportNoLimit] = useState(true);

  const [draggingWidget, setDraggingWidget] = useState<WorkspaceWidgetId | null>(null);
  const [resizingWidget, setResizingWidget] = useState<{
    id: WorkspaceWidgetId;
    startY: number;
    startHeight: number;
  } | null>(null);

  const [viewName, setViewName] = useState('');
  const [viewDescription, setViewDescription] = useState('');
  const [viewCombineMode, setViewCombineMode] = useState<DataViewCombineMode>('row_index');
  const [builderDatasetId, setBuilderDatasetId] = useState('');
  const [builderColumn, setBuilderColumn] = useState('');
  const [builderAlias, setBuilderAlias] = useState('');
  const [builderColumns, setBuilderColumns] = useState<DataViewColumn[]>([]);
  const [joinBaseDatasetId, setJoinBaseDatasetId] = useState('');
  const [joinBaseKeyColumn, setJoinBaseKeyColumn] = useState('');
  const [joinType, setJoinType] = useState<DataViewJoinType>('left');
  const [oneToManyMode, setOneToManyMode] = useState<DataViewOneToManyMode>('expand');
  const [joinTargetDatasetId, setJoinTargetDatasetId] = useState('');
  const [joinTargetKeyColumn, setJoinTargetKeyColumn] = useState('');
  const [joinTargets, setJoinTargets] = useState<ViewJoinTarget[]>([]);

  const [previewSourceType, setPreviewSourceType] = useState<WorkspaceSourceType>('dataset');
  const [previewSourceId, setPreviewSourceId] = useState<string>();
  const [previewMode, setPreviewMode] = useState<PreviewMode>('table');
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [duplicateRowIndices, setDuplicateRowIndices] = useState<Set<number>>(new Set());
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<Record<string, any> | null>(null);
  const [hierarchyColumns, setHierarchyColumns] = useState<string[]>([]);
  const [sqlQuery, setSqlQuery] = useState(DEFAULT_SQL_QUERY);
  const [sqlResult, setSqlResult] = useState<SqlQueryResult | null>(null);
  const [sqlError, setSqlError] = useState('');
  const [runningSql, setRunningSql] = useState(false);
  const [sqlSnippetName, setSqlSnippetName] = useState('');
  const [tablePageSize, setTablePageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const [tablePage, setTablePage] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatResponding, setChatResponding] = useState(false);
  const [activeKpiInfoId, setActiveKpiInfoId] = useState<string>();
  const [kpiAdviceByCard, setKpiAdviceByCard] = useState<Record<string, KpiAdvicePayload>>({});
  const [kpiAdviceLoadingCard, setKpiAdviceLoadingCard] = useState<string>();
  const [kpiAdviceError, setKpiAdviceError] = useState('');
  const [inspectingKpiIssue, setInspectingKpiIssue] = useState<{ cardId: string; helpId: string; scope: 'workspace' | 'dataset' } | null>(null);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSPACES_STORAGE_KEY);
      if (!raw) {
        setLoadingStorage(false);
        return;
      }

      const parsed = JSON.parse(raw);
      const loaded = Array.isArray(parsed) ? parsed.map(normalizeWorkspace) : [];
      setWorkspaces(loaded);
      if (loaded.length > 0) {
        setActiveWorkspaceId(loaded[0].id);
      }
    } catch (storageError) {
      console.warn('Unable to load workspace state:', storageError);
    } finally {
      setLoadingStorage(false);
    }
  }, []);

  useEffect(() => {
    if (loadingStorage) return;
    try {
      localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces));
    } catch (storageError) {
      console.warn('Unable to persist workspace state:', storageError);
    }
  }, [loadingStorage, workspaces]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );

  const activeDataset = useMemo(() => {
    if (!activeWorkspace) return undefined;
    if (activeWorkspace.activeDatasetId) {
      return activeWorkspace.datasets.find((dataset) => dataset.id === activeWorkspace.activeDatasetId);
    }
    return activeWorkspace.datasets[0];
  }, [activeWorkspace]);

  useEffect(() => {
    if (!activeWorkspace) return;

    if (activeWorkspace.datasets.length > 0) {
      if (!builderDatasetId) {
        const firstDatasetId = activeWorkspace.datasets[0].id;
        setBuilderDatasetId(firstDatasetId);
        setBuilderColumn(activeWorkspace.datasets[0].columns[0] || '');
      }

      if (!joinBaseDatasetId) {
        const firstDatasetId = activeWorkspace.datasets[0].id;
        setJoinBaseDatasetId(firstDatasetId);
        setJoinBaseKeyColumn(activeWorkspace.datasets[0].columns[0] || '');
      }
    }

    if (previewSourceType === 'dataset') {
      const fallbackDataset = activeWorkspace.datasets[0];
      if (!previewSourceId || !activeWorkspace.datasets.some((dataset) => dataset.id === previewSourceId)) {
        setPreviewSourceId(activeWorkspace.activeDatasetId || fallbackDataset?.id);
      }
    } else {
      const fallbackView = activeWorkspace.views[0];
      if (!previewSourceId || !activeWorkspace.views.some((view) => view.id === previewSourceId)) {
        setPreviewSourceId(activeWorkspace.activeViewId || fallbackView?.id);
      }
    }
  }, [
    activeWorkspace,
    builderDatasetId,
    joinBaseDatasetId,
    previewSourceId,
    previewSourceType,
  ]);

  useEffect(() => {
    if (!resizingWidget || !activeWorkspace) return;

    const onMouseMove = (event: MouseEvent) => {
      const delta = event.clientY - resizingWidget.startY;
      const nextHeight = clampWidgetHeight(resizingWidget.startHeight + delta);

      updateWorkspace(activeWorkspace.id, (workspace) => ({
        ...workspace,
        widgetSizes: {
          ...(workspace.widgetSizes || {}),
          [resizingWidget.id]: nextHeight,
        },
      }));
    };

    const onMouseUp = () => {
      setResizingWidget(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeWorkspace, resizingWidget]);

  const availableBuilderColumns = useMemo(() => {
    if (!activeWorkspace || !builderDatasetId) return [];
    return activeWorkspace.datasets.find((dataset) => dataset.id === builderDatasetId)?.columns || [];
  }, [activeWorkspace, builderDatasetId]);

  const availableJoinBaseKeyColumns = useMemo(() => {
    if (!activeWorkspace || !joinBaseDatasetId) return [];
    return activeWorkspace.datasets.find((dataset) => dataset.id === joinBaseDatasetId)?.columns || [];
  }, [activeWorkspace, joinBaseDatasetId]);

  const availableJoinTargetKeyColumns = useMemo(() => {
    if (!activeWorkspace || !joinTargetDatasetId) return [];
    return activeWorkspace.datasets.find((dataset) => dataset.id === joinTargetDatasetId)?.columns || [];
  }, [activeWorkspace, joinTargetDatasetId]);

  const joinableDatasets = useMemo(() => {
    if (!activeWorkspace || !joinBaseDatasetId) return [];
    const joinedIds = new Set(joinTargets.map((target) => target.datasetId));
    return activeWorkspace.datasets.filter(
      (dataset) => dataset.id !== joinBaseDatasetId && !joinedIds.has(dataset.id)
    );
  }, [activeWorkspace, joinBaseDatasetId, joinTargets]);

  const allowedBuilderDatasetIds = useMemo(() => {
    if (viewCombineMode !== 'join_by_key') return null;
    const ids = new Set<string>();
    if (joinBaseDatasetId) ids.add(joinBaseDatasetId);
    joinTargets.forEach((target) => ids.add(target.datasetId));
    return ids;
  }, [joinBaseDatasetId, joinTargets, viewCombineMode]);

  const availableBuilderDatasets = useMemo(() => {
    if (!activeWorkspace) return [];
    if (!allowedBuilderDatasetIds) return activeWorkspace.datasets;
    return activeWorkspace.datasets.filter((dataset) => allowedBuilderDatasetIds.has(dataset.id));
  }, [activeWorkspace, allowedBuilderDatasetIds]);

  const workbookSheetGroups = useMemo(() => {
    if (!activeWorkspace) return [];

    const groups = new Map<
      string,
      {
        fileName: string;
        sheets: ImportedDataset[];
      }
    >();

    activeWorkspace.datasets.forEach((dataset) => {
      if (!dataset.sourceSheet) return;
      const key = dataset.fileName || dataset.name;
      const existing = groups.get(key) || { fileName: dataset.fileName || dataset.name, sheets: [] };
      existing.sheets.push(dataset);
      groups.set(key, existing);
    });

    return Array.from(groups.values()).sort((left, right) =>
      left.fileName.localeCompare(right.fileName)
    );
  }, [activeWorkspace]);

  useEffect(() => {
    if (joinableDatasets.length === 0) {
      setJoinTargetDatasetId('');
      setJoinTargetKeyColumn('');
      return;
    }

    if (!joinTargetDatasetId || !joinableDatasets.some((dataset) => dataset.id === joinTargetDatasetId)) {
      const first = joinableDatasets[0];
      setJoinTargetDatasetId(first.id);
      setJoinTargetKeyColumn(first.columns[0] || '');
    }
  }, [joinTargetDatasetId, joinableDatasets]);

  useEffect(() => {
    if (availableBuilderDatasets.length === 0) {
      setBuilderDatasetId('');
      setBuilderColumn('');
      return;
    }

    if (!builderDatasetId || !availableBuilderDatasets.some((dataset) => dataset.id === builderDatasetId)) {
      const dataset = availableBuilderDatasets[0];
      setBuilderDatasetId(dataset.id);
      setBuilderColumn(dataset.columns[0] || '');
    }
  }, [availableBuilderDatasets, builderDatasetId]);

  const previewSource = useMemo(() => {
    if (!activeWorkspace) return undefined;
    return resolveWorkspaceSource(activeWorkspace, previewSourceType, previewSourceId);
  }, [activeWorkspace, previewSourceType, previewSourceId]);

  useEffect(() => {
    setSqlResult(null);
    setSqlError('');
    setTablePage(1);
    setSelectedRowIndices(new Set());
    setDuplicateRowIndices(new Set());
    setEditingRowIndex(null);
    setEditingRowData(null);
  }, [previewSource?.id]);

  useEffect(() => {
    if (previewMode === 'hierarchy' && previewSource && hierarchyColumns.length === 0) {
      const sample = previewSource.records.slice(0, 500);
      const cardinalities = previewSource.columns.map(col => {
        const uniqueValues = new Set();
        for (const row of sample) {
          if (row[col] !== null && row[col] !== undefined && row[col] !== '') {
            uniqueValues.add(row[col]);
          }
        }
        return {
          col,
          count: uniqueValues.size,
          isValid: uniqueValues.size > 1 && uniqueValues.size < sample.length * 0.8
        };
      });

      const bestCols = cardinalities
        .filter(c => c.isValid)
        .sort((a, b) => a.count - b.count)
        .slice(0, 3)
        .map(c => c.col);

      if (bestCols.length > 0) {
        setHierarchyColumns(bestCols);
      } else {
        setHierarchyColumns(previewSource.columns.slice(0, Math.min(3, previewSource.columns.length)));
      }
    }
  }, [previewMode, previewSource]);

  useEffect(() => {
    setSqlSnippetName('');
    setChatInput('');
    setChatMessages([]);
    setChatOpen(false);
    setActiveKpiInfoId(undefined);
    setKpiAdviceByCard({});
    setKpiAdviceLoadingCard(undefined);
    setKpiAdviceError('');
  }, [activeWorkspaceId]);

  useEffect(() => {
    setTablePage(1);
  }, [tablePageSize]);

  const previewDataset = useMemo(
    () => (previewSource ? sourceToDataset(previewSource) : undefined),
    [previewSource]
  );

  const tabularColumns = useMemo(
    () => (sqlResult ? sqlResult.columns : previewSource?.columns || []),
    [previewSource, sqlResult]
  );

  const tabularRows = useMemo(
    () => (sqlResult ? sqlResult.records : previewSource?.records || []),
    [previewSource, sqlResult]
  );

  const tableTotalPages = useMemo(
    () => Math.max(1, Math.ceil(tabularRows.length / tablePageSize)),
    [tabularRows.length, tablePageSize]
  );

  useEffect(() => {
    if (tablePage > tableTotalPages) {
      setTablePage(tableTotalPages);
    }
  }, [tablePage, tableTotalPages]);

  const datasetProfile = useMemo(
    () => (previewDataset ? buildDatasetProfile(previewDataset) : undefined),
    [previewDataset]
  );

  const workspaceKpis = useMemo(
    () => (activeWorkspace ? buildWorkspaceKpis(activeWorkspace) : undefined),
    [activeWorkspace]
  );

  const viewProfiles = useMemo(() => {
    if (!activeWorkspace) return [];
    return activeWorkspace.views.map((view) => {
      const materialized = materializeWorkspaceView(activeWorkspace, view);
      return {
        view,
        profile: buildDatasetProfile(materialized),
      };
    });
  }, [activeWorkspace]);

  const hierarchyTree = useMemo(() => {
    if (!previewSource || previewMode !== 'hierarchy') return [];
    const sampled = previewSource.records.slice(0, 2000);
    return buildHierarchy(sampled, hierarchyColumns);
  }, [previewSource, previewMode, hierarchyColumns]);

  const reportMarkdown = useMemo(
    () => (activeWorkspace ? buildWorkspaceReportMarkdown(activeWorkspace) : ''),
    [activeWorkspace]
  );
  const reportCsv = useMemo(
    () => (activeWorkspace ? buildWorkspaceReportCsv(activeWorkspace) : ''),
    [activeWorkspace]
  );

  const workspaceGraph = useMemo(
    () => (activeWorkspace ? buildWorkspaceGraph(activeWorkspace) : { nodes: [], edges: [] }),
    [activeWorkspace]
  );
  const sqlSnippetItems = useMemo(
    () => activeWorkspace?.sqlSnippets || [],
    [activeWorkspace]
  );
  const sqlHistoryItems = useMemo(
    () => (activeWorkspace?.sqlHistory || []).slice(0, MAX_SQL_HISTORY_PREVIEW),
    [activeWorkspace]
  );

  function updateWorkspace(workspaceId: string, updater: (workspace: Workspace) => Workspace) {
    setWorkspaces((previous) =>
      previous.map((workspace) => (workspace.id === workspaceId ? updater(workspace) : workspace))
    );
  }

  const createWorkspace = () => {
    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      setError('Workspace name is required.');
      return;
    }

    const workspace: Workspace = {
      id: crypto.randomUUID(),
      name: trimmedName,
      createdAt: new Date().toISOString(),
      datasets: [],
      views: [],
      widgetLayout: DEFAULT_WIDGET_LAYOUT,
      widgetSizes: {},
      collapsedWidgets: buildDefaultCollapsedWidgets(),
      activeDatasetId: undefined,
      activeViewId: undefined,
      sqlHistory: [],
      sqlSnippets: [],
    };

    setWorkspaces((previous) => [workspace, ...previous]);
    setActiveWorkspaceId(workspace.id);
    setWorkspaceName('');
    setActiveTab('workbench');
    setPreviewSourceType('dataset');
    setPreviewSourceId(undefined);
    setError('');
  };

  const removeWorkspace = (workspaceId: string) => {
    const filtered = workspaces.filter((workspace) => workspace.id !== workspaceId);
    setWorkspaces(filtered);
    if (activeWorkspaceId === workspaceId) {
      setActiveWorkspaceId(filtered[0]?.id);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!activeWorkspace) {
      setError('Create or select a workspace before importing files.');
      return;
    }

    let parsedMaxRecords: number | null = null;
    if (!importNoLimit) {
      const parsed = Number(importMaxRecords);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Import row limit must be a positive number, or enable "No row cap".');
        return;
      }
      parsedMaxRecords = Math.floor(parsed);
    }

    setUploading(true);
    setError('');

    const importedDatasets: ImportedDataset[] = [];
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('maxRecords', importNoLimit ? 'all' : String(parsedMaxRecords));
        const response = await fetch('/api/workspaces/parse-file', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || `Failed to import ${file.name}`);
        }

        const fileDatasets = Array.isArray(payload.datasets)
          ? (payload.datasets as ImportedDataset[])
          : payload.dataset
            ? [payload.dataset as ImportedDataset]
            : [];

        importedDatasets.push(...fileDatasets);
      }

      if (importedDatasets.length > 0) {
        updateWorkspace(activeWorkspace.id, (workspace) => ({
          ...workspace,
          datasets: [...workspace.datasets, ...importedDatasets],
          activeDatasetId: importedDatasets[0].id,
        }));
        setPreviewSourceType('dataset');
        setPreviewSourceId(importedDatasets[0].id);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to import files');
    } finally {
      setUploading(false);
    }
  };

  const removeDataset = (datasetId: string) => {
    if (!activeWorkspace) return;

    updateWorkspace(activeWorkspace.id, (workspace) => {
      const datasets = workspace.datasets.filter((dataset) => dataset.id !== datasetId);
      const views = workspace.views.filter(
        (view) => {
          const usedInColumns = view.columns.some((column) => column.datasetId === datasetId);
          const usedAsBase = view.joinConfig?.baseDatasetId === datasetId;
          const usedAsJoinTarget =
            view.joinConfig?.joins.some((join) => join.datasetId === datasetId) || false;
          return !usedInColumns && !usedAsBase && !usedAsJoinTarget;
        }
      );
      return {
        ...workspace,
        datasets,
        views,
        activeDatasetId: datasets[0]?.id,
        activeViewId: views[0]?.id,
      };
    });
  };

  const removeView = (viewId: string) => {
    if (!activeWorkspace) return;
    updateWorkspace(activeWorkspace.id, (workspace) => {
      const views = workspace.views.filter((view) => view.id !== viewId);
      return {
        ...workspace,
        views,
        activeViewId: views[0]?.id,
      };
    });
    if (previewSourceType === 'view' && previewSourceId === viewId) {
      setPreviewSourceType('dataset');
      setPreviewSourceId(activeWorkspace.datasets[0]?.id);
    }
  };

  const addBuilderColumn = () => {
    if (!builderDatasetId || !builderColumn) {
      setError('Select a dataset and column before adding.');
      return;
    }

    const alias = builderAlias.trim() || `${builderDatasetId.slice(0, 8)}_${builderColumn}`;
    setBuilderColumns((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        datasetId: builderDatasetId,
        sourceColumn: builderColumn,
        alias,
      },
    ]);
    setBuilderAlias('');
    setError('');
  };

  const addJoinTarget = () => {
    if (!joinTargetDatasetId || !joinTargetKeyColumn) {
      setError('Select a join dataset and key column.');
      return;
    }

    setJoinTargets((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        datasetId: joinTargetDatasetId,
        keyColumn: joinTargetKeyColumn,
      },
    ]);
    setError('');
  };

  const saveView = () => {
    if (!activeWorkspace) return;
    const trimmedName = viewName.trim();
    if (!trimmedName) {
      setError('View name is required.');
      return;
    }
    if (builderColumns.length === 0) {
      setError('Add at least one column to create a view.');
      return;
    }

    let joinConfig: WorkspaceDataView['joinConfig'] = undefined;
    if (viewCombineMode === 'join_by_key') {
      if (!joinBaseDatasetId || !joinBaseKeyColumn) {
        setError('Join mode requires base dataset and base key column.');
        return;
      }
      if (joinTargets.length === 0) {
        setError('Join mode requires at least one join target.');
        return;
      }

      const allowedDatasetIds = new Set<string>([joinBaseDatasetId, ...joinTargets.map((target) => target.datasetId)]);
      const hasInvalidColumn = builderColumns.some((column) => !allowedDatasetIds.has(column.datasetId));
      if (hasInvalidColumn) {
        setError('All selected columns must come from base dataset or configured join datasets.');
        return;
      }

      joinConfig = {
        baseDatasetId: joinBaseDatasetId,
        baseKeyColumn: joinBaseKeyColumn,
        joinType,
        oneToManyMode,
        joins: joinTargets,
      };
    }

    const now = new Date().toISOString();
    const view: WorkspaceDataView = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: viewDescription.trim() || undefined,
      combineMode: viewCombineMode,
      joinConfig,
      columns: builderColumns,
      createdAt: now,
      updatedAt: now,
    };

    updateWorkspace(activeWorkspace.id, (workspace) => ({
      ...workspace,
      views: [view, ...workspace.views],
      activeViewId: view.id,
    }));

    setViewName('');
    setViewDescription('');
    setViewCombineMode('row_index');
    setBuilderColumns([]);
    setJoinType('left');
    setOneToManyMode('expand');
    setJoinTargets([]);
    setPreviewSourceType('view');
    setPreviewSourceId(view.id);
    setError('');
  };

  const moveWidget = (target: WorkspaceWidgetId) => {
    if (!activeWorkspace || !draggingWidget) return;

    updateWorkspace(activeWorkspace.id, (workspace) => {
      const layout = workspace.widgetLayout || DEFAULT_WIDGET_LAYOUT;
      return {
        ...workspace,
        widgetLayout: reorderLayout(layout, draggingWidget, target),
      };
    });
    setDraggingWidget(null);
  };

  const getWidgetHeight = (widgetId: WorkspaceWidgetId) => {
    const customHeight = activeWorkspace?.widgetSizes?.[widgetId];
    return clampWidgetHeight(
      typeof customHeight === 'number' ? customHeight : DEFAULT_WIDGET_HEIGHT
    );
  };

  const getWidgetCollapsed = (widgetId: WorkspaceWidgetId) =>
    activeWorkspace?.collapsedWidgets?.[widgetId] ?? true;

  const toggleWidgetCollapsed = (widgetId: WorkspaceWidgetId) => {
    if (!activeWorkspace) return;

    updateWorkspace(activeWorkspace.id, (workspace) => ({
      ...workspace,
      collapsedWidgets: {
        ...buildDefaultCollapsedWidgets(),
        ...(workspace.collapsedWidgets || {}),
        [widgetId]: !(workspace.collapsedWidgets?.[widgetId] ?? true),
      },
    }));
  };

  const startResizeWidget = (
    widgetId: WorkspaceWidgetId,
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    setDraggingWidget(null);
    setResizingWidget({
      id: widgetId,
      startY: event.clientY,
      startHeight: getWidgetHeight(widgetId),
    });
  };

  const resetSqlPreview = () => {
    setSqlQuery(DEFAULT_SQL_QUERY);
    setSqlResult(null);
    setSqlError('');
    setSqlSnippetName('');
  };

  const saveSqlSnippet = () => {
    if (!activeWorkspace) {
      setSqlError('Select a workspace before saving snippets.');
      return;
    }

    const name = sqlSnippetName.trim();
    const query = sqlQuery.trim();
    if (!name) {
      setSqlError('Snippet name is required.');
      return;
    }
    if (!query) {
      setSqlError('Query cannot be empty.');
      return;
    }

    const now = new Date().toISOString();
    updateWorkspace(activeWorkspace.id, (workspace) => {
      const existing = workspace.sqlSnippets || [];
      const duplicateIndex = existing.findIndex(
        (snippet) => snippet.name.toLowerCase() === name.toLowerCase()
      );

      if (duplicateIndex >= 0) {
        const snippet = existing[duplicateIndex];
        const updated: WorkspaceSqlSnippet = {
          ...snippet,
          query,
          updatedAt: now,
        };
        return {
          ...workspace,
          sqlSnippets: [updated, ...existing.filter((item) => item.id !== snippet.id)],
        };
      }

      const snippet: WorkspaceSqlSnippet = {
        id: crypto.randomUUID(),
        name,
        query,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...workspace,
        sqlSnippets: [snippet, ...existing],
      };
    });

    setSqlError('');
    setSqlSnippetName('');
  };

  const loadSqlSnippet = (snippet: WorkspaceSqlSnippet) => {
    setSqlQuery(snippet.query);
    setSqlSnippetName(snippet.name);
    setSqlResult(null);
    setSqlError('');
  };

  const removeSqlSnippet = (snippetId: string) => {
    if (!activeWorkspace) return;
    updateWorkspace(activeWorkspace.id, (workspace) => ({
      ...workspace,
      sqlSnippets: (workspace.sqlSnippets || []).filter((snippet) => snippet.id !== snippetId),
    }));
  };

  const generateWorkflow = (title: string, assignedTo: string = 'Data Stewards') => {
    if (!activeWorkspace) return;
    updateWorkspace(activeWorkspace.id, (workspace) => {
      const workflows = workspace.workflows || [];
      return {
        ...workspace,
        workflows: [
          {
            id: crypto.randomUUID(),
            title,
            assignedTo,
            status: 'open',
            createdAt: new Date().toISOString()
          },
          ...workflows
        ]
      };
    });
  };

  const detectDuplicates = () => {
    if (!previewSource || previewSourceType !== 'dataset') return;
    const records = previewSource.records;
    const seen = new Set<string>();
    const duplicates = new Set<number>();
    const originalHashes = new Map<string, number>();

    records.forEach((record, index) => {
      const hash = JSON.stringify(record, Object.keys(record).sort());
      if (seen.has(hash)) {
        duplicates.add(index);
        const originalIndex = originalHashes.get(hash);
        if (originalIndex !== undefined) {
          duplicates.add(originalIndex);
        }
      } else {
        seen.add(hash);
        originalHashes.set(hash, index);
      }
    });

    setDuplicateRowIndices(duplicates);
    setSqlResult(null); // Reset SQL result if duplicates are being mapped
    // Optional: Sort so duplicates appear at top? No, let's keep it simple.
  };

  const handleEditRecord = (rowIndex: number) => {
    if (previewSourceType !== 'dataset' || !activeWorkspace || !previewSource) return;
    setEditingRowIndex(rowIndex);
    setEditingRowData({ ...previewSource.records[rowIndex] });
  };

  const saveEditedRecord = () => {
    if (editingRowIndex === null || !editingRowData || previewSourceType !== 'dataset' || !activeWorkspace || !previewSource) return;
    updateWorkspace(activeWorkspace.id, (workspace) => {
      const idx = workspace.datasets.findIndex(d => d.id === previewSource.id);
      if (idx === -1) return workspace;
      const newDatasets = [...workspace.datasets];
      const newRecords = [...newDatasets[idx].records];
      newRecords[editingRowIndex] = editingRowData;
      newDatasets[idx] = { ...newDatasets[idx], records: newRecords };
      return { ...workspace, datasets: newDatasets };
    });
    generateWorkflow(`Record edited in dataset ${previewSource.name}`, 'Data Quality Team');
    setEditingRowIndex(null);
    setEditingRowData(null);
  };

  const deleteSelectedRecords = () => {
    if (selectedRowIndices.size === 0 || previewSourceType !== 'dataset' || !activeWorkspace || !previewSource || sqlResult) return;
    updateWorkspace(activeWorkspace.id, (workspace) => {
      const idx = workspace.datasets.findIndex(d => d.id === previewSource.id);
      if (idx === -1) return workspace;
      const newDatasets = [...workspace.datasets];
      const newRecords = newDatasets[idx].records.filter((_, i) => !selectedRowIndices.has(i));
      newDatasets[idx] = { ...newDatasets[idx], records: newRecords, rowCount: newRecords.length };
      return { ...workspace, datasets: newDatasets };
    });
    generateWorkflow(`Deleted ${selectedRowIndices.size} record(s) from dataset ${previewSource.name}`, 'Data Quality Team');
    setSelectedRowIndices(new Set());
    if (tablePage > Math.ceil((previewSource.records.length - selectedRowIndices.size) / tablePageSize)) {
      setTablePage(Math.max(1, Math.ceil((previewSource.records.length - selectedRowIndices.size) / tablePageSize)));
    }
  };

  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const toggleAllRows = (rowIndices: number[]) => {
    setSelectedRowIndices(prev => {
      const allSelected = rowIndices.every(idx => prev.has(idx));
      const next = new Set(prev);
      if (allSelected) {
        rowIndices.forEach(idx => next.delete(idx));
      } else {
        rowIndices.forEach(idx => next.add(idx));
      }
      return next;
    });
  };

  const exportKpisResult = (format: 'json' | 'csv' | 'xml' | 'xlsx') => {
    if (!workspaceKpis || !activeWorkspace) return;

    const timestamp = buildTimestampToken(new Date());
    const workspaceSegment = toFileSafeSegment(activeWorkspace.name);
    const fileBase = `${workspaceSegment}-data-quality-kpis-${timestamp}`;

    const flatKpis = Object.entries(workspaceKpis).map(([k, v]) => ({ Metric: k, Value: String(v) }));

    if (format === 'csv') {
      const csv = `Metric,Value\n` + flatKpis.map(k => `"${k.Metric}","${k.Value.replace(/"/g, '""')}"`).join('\n');
      downloadText(`${fileBase}.csv`, csv, 'text/csv');
      return;
    }

    if (format === 'xml') {
      const xml = `<KPIs>\n` + flatKpis.map(k => `  <KPI>\n    <Metric>${k.Metric}</Metric>\n    <Value>${k.Value}</Value>\n  </KPI>`).join('\n') + `\n</KPIs>`;
      downloadText(`${fileBase}.xml`, xml, 'application/xml');
      return;
    }

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(flatKpis);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KPIs");
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      return;
    }

    downloadText(
      `${fileBase}.json`,
      JSON.stringify(workspaceKpis, null, 2),
      'application/json'
    );
  };

  const exportHierarchyResult = (format: 'json' | 'csv' | 'xml' | 'xlsx') => {
    if (!previewSource || hierarchyTree.length === 0 || !activeWorkspace) return;

    const timestamp = buildTimestampToken(new Date());
    const workspaceSegment = toFileSafeSegment(activeWorkspace.name);
    const sourceSegment = toFileSafeSegment(previewSource.name);
    const fileBase = `${workspaceSegment}-${sourceSegment}-hierarchy-${timestamp}`;

    const flattenTree = (nodes: any[], path: string[] = []): any[] => {
      let rows: any[] = [];
      for (const node of nodes) {
        const currentPath = [...path, node.label];
        if (node.children && node.children.length > 0) {
          rows = rows.concat(flattenTree(node.children, currentPath));
        } else {
          const row: any = {};
          currentPath.forEach((p, i) => row[`Level_${i + 1}`] = p);
          row['Count'] = node.count;
          rows.push(row);
        }
      }
      return rows;
    };
    const flatTree = flattenTree(hierarchyTree);

    if (format === 'xml') {
      const buildXmlTree = (nodes: any[], level: number = 0): string => {
        const indent = '  '.repeat(level + 1);
        const innerIndent = '  '.repeat(level + 2);
        let xml = '';
        for (const node of nodes) {
          xml += `${indent}<Node>\n`;
          const safeLabel = String(node.label)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          xml += `${innerIndent}<Label>${safeLabel}</Label>\n`;
          xml += `${innerIndent}<Count>${node.count}</Count>\n`;
          if (node.children && node.children.length > 0) {
            xml += `${innerIndent}<Children>\n`;
            xml += buildXmlTree(node.children, level + 2);
            xml += `${innerIndent}</Children>\n`;
          }
          xml += `${indent}</Node>\n`;
        }
        return xml;
      };

      const xml = `<Hierarchy>\n${buildXmlTree(hierarchyTree)}\n</Hierarchy>`;
      downloadText(`${fileBase}.xml`, xml, 'application/xml');
      return;
    }

    const flattenTreeHierarchical = (nodes: any[], depth: number = 0): any[] => {
      let rows: any[] = [];
      for (const node of nodes) {
        const row: any = {};
        for (let i = 0; i < hierarchyColumns.length; i++) {
          row[`Level_${i + 1}`] = i === depth ? node.label : '';
        }
        row['Count'] = node.count;
        rows.push(row);

        if (node.children && node.children.length > 0) {
          rows = rows.concat(flattenTreeHierarchical(node.children, depth + 1));
        }
      }
      return rows;
    };
    const hierarchicalRows = flattenTreeHierarchical(hierarchyTree);

    if (format === 'csv') {
      if (hierarchicalRows.length === 0) return;
      const headers = Object.keys(hierarchicalRows[0]);
      const csv = headers.join(',') + '\n' + hierarchicalRows.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadText(`${fileBase}.csv`, csv, 'text/csv');
      return;
    }

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(hierarchicalRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hierarchy");
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      return;
    }

    downloadText(
      `${fileBase}.json`,
      JSON.stringify(hierarchyTree, null, 2),
      'application/json'
    );
  };

  const clearSqlHistory = () => {
    if (!activeWorkspace) return;
    updateWorkspace(activeWorkspace.id, (workspace) => ({
      ...workspace,
      sqlHistory: [],
    }));
  };

  const exportSqlResult = (format: 'json' | 'csv' | 'xml' | 'xlsx') => {
    if (!sqlResult || !previewSource || !activeWorkspace) return;

    const timestamp = buildTimestampToken(new Date());
    const workspaceSegment = toFileSafeSegment(activeWorkspace.name);
    const sourceSegment = toFileSafeSegment(previewSource.name);
    const fileBase = `${workspaceSegment}-${sourceSegment}-sql-result-${timestamp}`;

    if (format === 'csv') {
      const content = toCsv({
        id: crypto.randomUUID(),
        name: 'sql_result',
        fileName: `${fileBase}.csv`,
        format: 'csv',
        kind: 'tabular',
        rowCount: sqlResult.rowCount,
        columns: sqlResult.columns,
        records: sqlResult.records,
        parseWarnings: [],
        importedAt: new Date().toISOString(),
      });
      downloadText(`${fileBase}.csv`, content, 'text/csv');
      return;
    }

    if (format === 'xml') {
      const xml = `<Records>\n` + sqlResult.records.map((r: any) =>
        `  <Record>\n` + Object.entries(r).map(([k, v]) => `    <${toFileSafeSegment(k)}>${v}</${toFileSafeSegment(k)}>`).join('\n') + `\n  </Record>`
      ).join('\n') + `\n</Records>`;
      downloadText(`${fileBase}.xml`, xml, 'application/xml');
      return;
    }

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(sqlResult.records);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SQL Result");
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      return;
    }

    downloadText(
      `${fileBase}.json`,
      JSON.stringify(sqlResult.records, null, 2),
      'application/json'
    );
  };

  const runSqlQuery = async () => {
    if (!previewSource) {
      setSqlError('Select a source before running SQL.');
      return;
    }

    const query = sqlQuery.trim().replace(/;+\s*$/, '');
    if (!query) {
      setSqlError('Enter a SQL query.');
      return;
    }

    if (!/^select\b/i.test(query)) {
      setSqlError('Only SELECT queries are supported in Data Viewer SQL mode.');
      return;
    }
    if (query.includes(';')) {
      setSqlError('Only a single SELECT statement is supported.');
      return;
    }

    setRunningSql(true);
    setSqlError('');

    const toRecordRows = (rows: unknown[]): Record<string, unknown>[] =>
      rows.map((row) => {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
          return row as Record<string, unknown>;
        }
        return { value: row };
      });

    try {
      const alaSql = await getAlaSql();

      alaSql('DROP TABLE IF EXISTS source');
      alaSql('CREATE TABLE source');
      if (alaSql.tables.source) {
        alaSql.tables.source.data = previewSource.records as unknown[];
      }

      const raw = alaSql(query) as unknown;
      const resultRows = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
      const records = toRecordRows(resultRows);
      const columns = Array.from(
        new Set(records.flatMap((record) => Object.keys(record)))
      );

      const truncated = records.length > MAX_SQL_RESULT_ROWS;
      setSqlResult({
        columns,
        records: truncated ? records.slice(0, MAX_SQL_RESULT_ROWS) : records,
        rowCount: records.length,
        truncated,
      });

      if (activeWorkspace) {
        const historyEntry: WorkspaceSqlHistoryEntry = {
          id: crypto.randomUUID(),
          query,
          sourceType: previewSourceType,
          sourceId: previewSource.id,
          sourceName: previewSource.name,
          rowCount: records.length,
          executedAt: new Date().toISOString(),
        };

        updateWorkspace(activeWorkspace.id, (workspace) => {
          const previous = workspace.sqlHistory || [];
          const deduped = previous.filter(
            (entry) =>
              !(
                entry.query === historyEntry.query &&
                entry.sourceType === historyEntry.sourceType &&
                (entry.sourceId || '') === (historyEntry.sourceId || '')
              )
          );
          return {
            ...workspace,
            sqlHistory: [historyEntry, ...deduped].slice(0, MAX_SQL_HISTORY),
          };
        });
      }
    } catch (sqlRuntimeError) {
      setSqlResult(null);
      setSqlError(
        sqlRuntimeError instanceof Error
          ? sqlRuntimeError.message
          : 'Unable to execute SQL query.'
      );
    } finally {
      setRunningSql(false);
      try {
        window.alasql?.('DROP TABLE IF EXISTS source');
      } catch (cleanupError) {
        console.warn('Unable to cleanup SQL source table:', cleanupError);
      }
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };

    setChatMessages((previous) => [...previous, userMessage]);
    setChatInput('');
    setChatResponding(true);

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: buildDataChatResponse(text, previewSource),
      createdAt: new Date().toISOString(),
    };

    setChatMessages((previous) => [...previous, assistantMessage]);
    setChatResponding(false);
  };

  const requestKpiAdvice = async (params: {
    cardId: string;
    helpId: string;
    scope: KpiScope;
    metricValue: number;
  }) => {
    const help = KPI_HELP[params.helpId];
    if (!help) return;

    setKpiAdviceError('');
    setKpiAdviceLoadingCard(params.cardId);
    try {
      const contextParts = [
        `Workspace KPI snapshot for ${activeWorkspace?.name || 'workspace'}.`,
        workspaceKpis
          ? `Quality ${workspaceKpis.avgQualityScore.toFixed(1)}%, table health ${workspaceKpis.avgTableHealthScore.toFixed(1)}%, data-to-errors ${workspaceKpis.dataToErrorsRatio.toFixed(2)}:1.`
          : '',
        datasetProfile
          ? `Active source ${datasetProfile.datasetName}: quality ${datasetProfile.qualityScore.toFixed(1)}%, table health ${datasetProfile.tableHealthScore.toFixed(1)}%, completeness ${datasetProfile.completenessPct.toFixed(1)}%.`
          : '',
      ].filter(Boolean);

      const response = await fetch('/api/ai/kpi-improvement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricId: params.helpId,
          metricName: help.title,
          metricValue: params.metricValue,
          scope: params.scope,
          workspaceName: activeWorkspace?.name,
          datasetName: datasetProfile?.datasetName,
          context: contextParts.join(' '),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to generate KPI advice.');
      }

      const advice = payload?.advice as KpiAdvicePayload | undefined;
      if (!advice || !Array.isArray(advice.actions)) {
        throw new Error('Received invalid AI advice payload.');
      }

      setKpiAdviceByCard((previous) => ({
        ...previous,
        [params.cardId]: advice,
      }));
    } catch (adviceError) {
      setKpiAdviceError(
        adviceError instanceof Error ? adviceError.message : 'Unable to generate KPI advice.'
      );
    } finally {
      setKpiAdviceLoadingCard(undefined);
    }
  };

  const renderKpiCard = (params: {
    cardId: string;
    helpId: string;
    value: number;
    format: KpiValueFormat;
    scope: KpiScope;
    className?: string;
  }) => {
    const help = KPI_HELP[params.helpId];
    if (!help) return null;
    const advice = kpiAdviceByCard[params.cardId];
    const loading = kpiAdviceLoadingCard === params.cardId;
    const infoOpen = activeKpiInfoId === params.cardId;

    return (
      <div
        key={params.cardId}
        className={`p-4 rounded-lg bg-slate-800/60 border border-slate-700/70 ${params.className || ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-slate-400 uppercase">{help.title}</p>
          <button
            onClick={() => setActiveKpiInfoId((previous) => (previous === params.cardId ? undefined : params.cardId))}
            className="text-slate-300 hover:text-cyan-300"
            title={`${help.description}\nWhy important: ${help.importance}`}
          >
            <CircleHelp className="w-4 h-4" />
          </button>
        </div>

        <p className="text-2xl font-semibold text-slate-100 mt-1">
          {formatKpiValue(params.value, params.format)}
        </p>

        {infoOpen && (
          <div className="mt-2 rounded border border-cyan-500/30 bg-cyan-500/10 p-2">
            <p className="text-[11px] text-cyan-100">{help.description}</p>
            <p className="text-[11px] text-cyan-200 mt-1">Why important: {help.importance}</p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() =>
              requestKpiAdvice({
                cardId: params.cardId,
                helpId: params.helpId,
                scope: params.scope,
                metricValue: params.value,
              })
            }
            disabled={loading}
            className="flex-1 px-3 py-2 rounded text-xs bg-cyan-700 text-white hover:bg-cyan-600 disabled:opacity-60 flex items-center justify-center gap-1"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {loading ? 'Generating Suggestions...' : 'Improve with Gemini AI'}
          </button>
          <button
            onClick={() => setInspectingKpiIssue({ cardId: params.cardId, helpId: params.helpId, scope: params.scope })}
            className="px-3 py-2 rounded text-xs bg-slate-700 text-slate-200 hover:bg-slate-600 flex items-center justify-center"
            title="Inspect rows contributing to this issue"
          >
            Inspect Records
          </button>
        </div>

        {advice && (
          <div className="mt-3 rounded border border-slate-700/70 bg-slate-950/50 p-2 space-y-2">
            <p className="text-xs text-slate-300">{advice.summary}</p>
            {advice.actions.slice(0, 2).map((action, index) => (
              <div key={`${params.cardId}-action-${index}`} className="text-xs text-slate-300">
                <p className="font-medium text-slate-100">
                  {action.title} ({action.impact})
                </p>
                <p className="text-slate-400">{action.why}</p>
                {action.steps.length > 0 && (
                  <div className="text-slate-500 mt-1">
                    {action.steps.slice(0, 3).map((step, stepIndex) => (
                      <p key={`${params.cardId}-step-${index}-${stepIndex}`}>{stepIndex + 1}. {step}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {advice.quickWins.length > 0 && (
              <div className="text-xs text-emerald-300">
                <p className="font-medium">Quick Wins</p>
                {advice.quickWins.slice(0, 3).map((quickWin, index) => (
                  <p key={`${params.cardId}-quick-${index}`}>{index + 1}. {quickWin}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderImporterWidget = () => (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Supported: Excel, CSV, SQL, DOCX, PDF, Parquet, TXT, JSON
      </p>
      <div className="p-3 rounded border border-slate-700/60 bg-slate-900/50 space-y-2">
        <p className="text-xs text-slate-300">Import Row Limit (per dataset/sheet)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          <input
            type="number"
            min={1}
            step={1000}
            value={importMaxRecords}
            onChange={(event) => setImportMaxRecords(event.target.value)}
            disabled={importNoLimit}
            className="input-field md:col-span-2"
            placeholder="5000"
          />
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={importNoLimit}
              onChange={(event) => setImportNoLimit(event.target.checked)}
            />
            No row cap
          </label>
        </div>
        <p className="text-[11px] text-slate-500">
          Use a higher limit or disable capping for large files. Very large imports will consume more browser memory.
        </p>
      </div>
      <input
        type="file"
        multiple
        accept={SUPPORTED_ACCEPT}
        onChange={(event) => {
          uploadFiles(event.target.files);
          event.currentTarget.value = '';
        }}
        className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white hover:file:bg-blue-500"
      />
      {uploading && (
        <p className="text-slate-400 text-sm flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Importing and parsing files...
        </p>
      )}
    </div>
  );

  const renderDatasetsWidget = () => (
    <div className="space-y-2">
      {!activeWorkspace || activeWorkspace.datasets.length === 0 ? (
        <p className="text-slate-400 text-sm">No datasets imported yet.</p>
      ) : (
        <>
          {workbookSheetGroups.length > 0 && (
            <div className="p-3 rounded border border-cyan-500/30 bg-cyan-500/5">
              <p className="text-xs uppercase text-cyan-300 mb-2">Workbook Sheets</p>
              <div className="space-y-2">
                {workbookSheetGroups.map((group) => (
                  <div key={group.fileName}>
                    <p className="text-xs text-slate-300 mb-1">
                      {group.fileName} ({group.sheets.length} sheets)
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.sheets.map((sheetDataset) => (
                        <button
                          key={sheetDataset.id}
                          onClick={() => {
                            if (!activeWorkspace) return;
                            updateWorkspace(activeWorkspace.id, (workspace) => ({
                              ...workspace,
                              activeDatasetId: sheetDataset.id,
                            }));
                            setPreviewSourceType('dataset');
                            setPreviewSourceId(sheetDataset.id);
                            setPreviewMode('table');
                          }}
                          className={`px-2 py-1 rounded text-xs ${sheetDataset.id === activeDataset?.id
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                          {sheetDataset.sourceSheet}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeWorkspace.datasets.map((dataset) => (
            <div
              key={dataset.id}
              className={`p-3 rounded-lg border ${dataset.id === activeDataset?.id
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-slate-700/70 bg-slate-800/50'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  className="text-left"
                  onClick={() => {
                    if (!activeWorkspace) return;
                    updateWorkspace(activeWorkspace.id, (workspace) => ({
                      ...workspace,
                      activeDatasetId: dataset.id,
                    }));
                    setPreviewSourceType('dataset');
                    setPreviewSourceId(dataset.id);
                    setPreviewMode('table');
                  }}
                >
                  <p className="text-sm font-medium text-slate-100">{dataset.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {dataset.fileName} · {String(dataset.format || 'unknown').toUpperCase()} · {dataset.rowCount} rows
                  </p>
                  {dataset.sourceSheet && (
                    <p className="text-xs text-cyan-300 mt-1">Sheet: {dataset.sourceSheet}</p>
                  )}
                </button>
                <button
                  onClick={() => removeDataset(dataset.id)}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-red-300 hover:bg-slate-700"
                >
                  Remove
                </button>
              </div>
              {Array.isArray(dataset.parseWarnings) && dataset.parseWarnings.length > 0 && (
                <div className="mt-2 text-xs text-amber-300 space-y-1">
                  {dataset.parseWarnings.slice(0, 2).map((warning, index) => (
                    <p key={`${dataset.id}-warning-${index}`}>• {warning}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-slate-500">
            To view a sheet in tabular mode: click a sheet chip above or pick it from Data Viewer source dropdown.
          </p>
        </>
      )}
    </div>
  );

  const renderViewBuilderWidget = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="text"
          value={viewName}
          onChange={(event) => setViewName(event.target.value)}
          placeholder="View name"
          className="input-field"
        />
        <input
          type="text"
          value={viewDescription}
          onChange={(event) => setViewDescription(event.target.value)}
          placeholder="View description (optional)"
          className="input-field"
        />
        <select
          value={viewCombineMode}
          onChange={(event) => setViewCombineMode(event.target.value as DataViewCombineMode)}
          className="input-field"
        >
          <option value="row_index">Combine: Row Index</option>
          <option value="join_by_key">Combine: Join by Key</option>
        </select>
      </div>

      {viewCombineMode === 'join_by_key' && (
        <div className="space-y-2 p-3 rounded border border-cyan-500/30 bg-cyan-500/5">
          <div className="flex items-center gap-2 text-xs text-cyan-300">
            <Link2 className="w-3 h-3" />
            Configure base dataset and join keys
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <select
              value={joinBaseDatasetId}
              onChange={(event) => {
                setJoinBaseDatasetId(event.target.value);
                const dataset = activeWorkspace?.datasets.find((item) => item.id === event.target.value);
                setJoinBaseKeyColumn(dataset?.columns[0] || '');
                setJoinTargets([]);
              }}
              className="input-field"
            >
              <option value="">Select base dataset</option>
              {activeWorkspace?.datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
            <select
              value={joinBaseKeyColumn}
              onChange={(event) => setJoinBaseKeyColumn(event.target.value)}
              className="input-field"
            >
              <option value="">Select base key column</option>
              {availableJoinBaseKeyColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <select
              value={joinType}
              onChange={(event) => setJoinType(event.target.value as DataViewJoinType)}
              className="input-field"
            >
              <option value="left">Join Type: Left</option>
              <option value="inner">Join Type: Inner</option>
              <option value="full">Join Type: Full</option>
            </select>
            <select
              value={oneToManyMode}
              onChange={(event) => setOneToManyMode(event.target.value as DataViewOneToManyMode)}
              className="input-field"
            >
              <option value="expand">1:N Handling: Expand Rows</option>
              <option value="first_match">1:N Handling: First Match</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select
              value={joinTargetDatasetId}
              onChange={(event) => {
                setJoinTargetDatasetId(event.target.value);
                const dataset = activeWorkspace?.datasets.find((item) => item.id === event.target.value);
                setJoinTargetKeyColumn(dataset?.columns[0] || '');
              }}
              className="input-field"
            >
              <option value="">Select join dataset</option>
              {joinableDatasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
            <select
              value={joinTargetKeyColumn}
              onChange={(event) => setJoinTargetKeyColumn(event.target.value)}
              className="input-field"
            >
              <option value="">Select join key column</option>
              {availableJoinTargetKeyColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
            <button onClick={addJoinTarget} className="btn-secondary flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" />
              Add Join
            </button>
          </div>

          <div className="space-y-1">
            {joinTargets.length === 0 ? (
              <p className="text-xs text-slate-400">No join targets configured.</p>
            ) : (
              joinTargets.map((target) => {
                const dataset = activeWorkspace?.datasets.find((item) => item.id === target.datasetId);
                return (
                  <div
                    key={target.id}
                    className="px-3 py-2 rounded bg-slate-900/60 border border-slate-700/70 text-xs text-slate-200 flex items-center justify-between"
                  >
                    <span>
                      {joinBaseKeyColumn} ↔ {dataset?.name || target.datasetId}.{target.keyColumn}
                    </span>
                    <button
                      className="text-slate-400 hover:text-red-300"
                      onClick={() =>
                        setJoinTargets((previous) => previous.filter((item) => item.id !== target.id))
                      }
                    >
                      Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          value={builderDatasetId}
          onChange={(event) => {
            setBuilderDatasetId(event.target.value);
            const dataset = availableBuilderDatasets.find((item) => item.id === event.target.value);
            setBuilderColumn(dataset?.columns[0] || '');
          }}
          className="input-field"
        >
          <option value="">Select dataset</option>
          {availableBuilderDatasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </option>
          ))}
        </select>
        <select
          value={builderColumn}
          onChange={(event) => setBuilderColumn(event.target.value)}
          className="input-field"
        >
          <option value="">Select column</option>
          {availableBuilderColumns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={builderAlias}
          onChange={(event) => setBuilderAlias(event.target.value)}
          placeholder="Alias (optional)"
          className="input-field"
        />
        <button onClick={addBuilderColumn} className="btn-secondary">
          Add Column
        </button>
      </div>

      <div className="space-y-2">
        {builderColumns.length === 0 ? (
          <p className="text-xs text-slate-400">No columns added yet.</p>
        ) : (
          builderColumns.map((column) => {
            const dataset = activeWorkspace?.datasets.find((item) => item.id === column.datasetId);
            return (
              <div
                key={column.id}
                className="px-3 py-2 rounded bg-slate-900/50 border border-slate-700/70 text-xs text-slate-200 flex items-center justify-between"
              >
                <span>
                  {dataset?.name || column.datasetId} · {column.sourceColumn} → {column.alias}
                </span>
                <button
                  onClick={() =>
                    setBuilderColumns((previous) => previous.filter((item) => item.id !== column.id))
                  }
                  className="text-slate-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            );
          })
        )}
      </div>

      <button onClick={saveView} className="btn-primary">
        Save View
      </button>

      <div className="pt-3 border-t border-slate-700/70 space-y-2">
        <p className="text-xs uppercase text-slate-400">Saved Views</p>
        {!activeWorkspace || activeWorkspace.views.length === 0 ? (
          <p className="text-xs text-slate-400">No saved views yet.</p>
        ) : (
          activeWorkspace.views.map((view) => (
            <div
              key={view.id}
              className="px-3 py-2 rounded bg-slate-900/50 border border-slate-700/70 text-xs flex items-center justify-between"
            >
              <div>
                <p className="text-slate-200">{view.name}</p>
                <p className="text-slate-400">
                  {view.columns.length} columns ·{' '}
                  {view.combineMode === 'join_by_key'
                    ? `Join by key (${view.joinConfig?.joinType || 'left'}, ${view.joinConfig?.oneToManyMode || 'expand'})`
                    : 'Row index'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                  onClick={() => {
                    setPreviewSourceType('view');
                    setPreviewSourceId(view.id);
                  }}
                >
                  Open
                </button>
                <button
                  className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-red-300 hover:bg-slate-700"
                  onClick={() => removeView(view.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderDataViewerWidget = (fullPageTable = false) => {
    const tableColumns = tabularColumns;
    const tableRows = tabularRows;
    const currentPage = Math.min(tablePage, tableTotalPages);
    const pageStartIndex = (currentPage - 1) * tablePageSize;
    const pageEndIndex = Math.min(pageStartIndex + tablePageSize, tableRows.length);
    const displayedRows = tableRows.slice(pageStartIndex, pageEndIndex);
    const tableRowCount = sqlResult ? sqlResult.rowCount : previewSource?.rowCount || 0;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => {
              setPreviewSourceType('dataset');
              setPreviewSourceId(activeWorkspace?.activeDatasetId || activeWorkspace?.datasets[0]?.id);
            }}
            className={`px-3 py-2 rounded text-xs ${previewSourceType === 'dataset' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'
              }`}
          >
            Dataset Source
          </button>
          <button
            onClick={() => {
              setPreviewSourceType('view');
              setPreviewSourceId(activeWorkspace?.activeViewId || activeWorkspace?.views[0]?.id);
            }}
            className={`px-3 py-2 rounded text-xs ${previewSourceType === 'view' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'
              }`}
            disabled={!activeWorkspace || activeWorkspace.views.length === 0}
          >
            View Source
          </button>
          <select
            value={previewSourceId || ''}
            onChange={(event) => setPreviewSourceId(event.target.value)}
            className="input-field text-sm"
          >
            <option value="">Select source</option>
            {previewSourceType === 'dataset'
              ? activeWorkspace?.datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.sourceSheet
                    ? `${dataset.name} (Sheet: ${dataset.sourceSheet})`
                    : dataset.name}
                </option>
              ))
              : activeWorkspace?.views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
          </select>
        </div>

        {!previewSource ? (
          <div className="text-sm text-slate-400 text-center py-6">Select a source to preview data.</div>
        ) : (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewMode('table')}
                className={`px-3 py-2 rounded text-xs flex items-center gap-1 ${previewMode === 'table' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'
                  }`}
              >
                <Table2 className="w-4 h-4" />
                Tabular
              </button>
              <button
                onClick={() => setPreviewMode('hierarchy')}
                className={`px-3 py-2 rounded text-xs flex items-center gap-1 ${previewMode === 'hierarchy' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'
                  }`}
              >
                <Spline className="w-4 h-4" />
                Hierarchical
              </button>
            </div>

            {previewMode === 'table' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                  <div className="xl:col-span-2 p-3 rounded border border-slate-700/70 bg-slate-900/50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-300">
                        SQL Query (SELECT only). Use table name <code>source</code>.
                      </p>
                      <p className="text-xs text-slate-400">
                        Available rows: {previewSource.rowCount}
                      </p>
                    </div>
                    <textarea
                      value={sqlQuery}
                      onChange={(event) => setSqlQuery(event.target.value)}
                      rows={4}
                      className="input-field w-full font-mono text-xs"
                      placeholder="SELECT * FROM source LIMIT 200"
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={runSqlQuery}
                        disabled={runningSql}
                        className="px-3 py-2 rounded text-xs bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-60"
                      >
                        {runningSql ? 'Running...' : 'Run SQL'}
                      </button>
                      <button
                        onClick={resetSqlPreview}
                        className="px-3 py-2 rounded text-xs bg-slate-800 text-slate-200 hover:bg-slate-700"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => exportSqlResult('csv')}
                        disabled={!sqlResult}
                        className="px-3 py-2 rounded text-xs bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        CSV
                      </button>
                      <button
                        onClick={() => exportSqlResult('json')}
                        disabled={!sqlResult}
                        className="px-3 py-2 rounded text-xs bg-emerald-800 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        JSON
                      </button>
                      <button
                        onClick={() => exportSqlResult('xml')}
                        disabled={!sqlResult}
                        className="px-3 py-2 rounded text-xs bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        XML
                      </button>
                      <button
                        onClick={() => exportSqlResult('xlsx')}
                        disabled={!sqlResult}
                        className="px-3 py-2 rounded text-xs bg-emerald-800 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Excel
                      </button>
                      <p className="text-xs text-slate-400">
                        {sqlResult
                          ? `Query rows: ${tableRowCount}${sqlResult.truncated ? ` (truncated to ${MAX_SQL_RESULT_ROWS})` : ''}`
                          : `Source rows available: ${previewSource.rowCount}`}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={sqlSnippetName}
                        onChange={(event) => setSqlSnippetName(event.target.value)}
                        placeholder="Snippet name"
                        className="input-field md:col-span-2"
                      />
                      <button
                        onClick={saveSqlSnippet}
                        className="px-3 py-2 rounded text-xs bg-slate-800 text-slate-100 hover:bg-slate-700"
                      >
                        Save Snippet
                      </button>
                    </div>
                    {sqlError && <p className="text-xs text-red-300">{sqlError}</p>}
                  </div>

                  <div className="p-3 rounded border border-slate-700/70 bg-slate-900/50 space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs uppercase text-slate-400">Saved Snippets</p>
                        <p className="text-xs text-slate-500">{sqlSnippetItems.length}</p>
                      </div>
                      {sqlSnippetItems.length === 0 ? (
                        <p className="text-xs text-slate-500">No snippets saved in this workspace.</p>
                      ) : (
                        <div className="space-y-1 max-h-40 overflow-auto pr-1">
                          {sqlSnippetItems.map((snippet) => (
                            <div
                              key={snippet.id}
                              className="rounded border border-slate-700/60 bg-slate-950/50 px-2 py-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-slate-200 truncate">{snippet.name}</p>
                                <button
                                  onClick={() => removeSqlSnippet(snippet.id)}
                                  className="text-slate-400 hover:text-red-300"
                                >
                                  Delete
                                </button>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                                <p className="text-slate-500 truncate">{snippet.query}</p>
                                <button
                                  onClick={() => loadSqlSnippet(snippet)}
                                  className="text-cyan-300 hover:text-cyan-200"
                                >
                                  Load
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs uppercase text-slate-400">Recent Query History</p>
                        <button
                          onClick={clearSqlHistory}
                          className="text-xs text-slate-500 hover:text-slate-300"
                          disabled={(activeWorkspace?.sqlHistory || []).length === 0}
                        >
                          Clear
                        </button>
                      </div>
                      {sqlHistoryItems.length === 0 ? (
                        <p className="text-xs text-slate-500">No recent query runs yet.</p>
                      ) : (
                        <div className="space-y-1 max-h-44 overflow-auto pr-1">
                          {sqlHistoryItems.map((entry) => (
                            <button
                              key={entry.id}
                              onClick={() => {
                                setSqlQuery(entry.query);
                                setSqlError('');
                                setSqlResult(null);
                              }}
                              className="w-full text-left rounded border border-slate-700/60 bg-slate-950/50 px-2 py-2 hover:border-cyan-500/50"
                            >
                              <p className="text-xs text-slate-200 truncate">{entry.query}</p>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {entry.sourceName} · {entry.rowCount} rows ·{' '}
                                {new Date(entry.executedAt).toLocaleString()}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded border border-slate-700/70 bg-slate-950/40 ${fullPageTable ? 'min-h-[calc(100vh-22rem)]' : ''
                    }`}
                >
                  <div className="p-2 border-b border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-400">
                      Showing {tableRows.length === 0 ? 0 : pageStartIndex + 1}-{pageEndIndex} of{' '}
                      {tableRows.length} loaded rows
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedRowIndices.size > 0 && (
                        <div className="flex items-center gap-2 mr-4 pr-4 border-r border-slate-700/60">
                          <span className="text-xs text-blue-300 font-medium">
                            {selectedRowIndices.size} selected
                          </span>
                          <button
                            onClick={deleteSelectedRecords}
                            className="px-2 py-1 rounded text-xs bg-red-900/50 text-red-200 hover:bg-red-800/60 border border-red-700/50 flex items-center gap-1"
                          >
                            Delete
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mr-4 pr-4 border-r border-slate-700/60">
                        <button
                          onClick={detectDuplicates}
                          className="px-2 py-1 rounded text-xs bg-amber-900/50 text-amber-200 hover:bg-amber-800/60 border border-amber-700/50 flex items-center gap-1"
                        >
                          Detect Duplicates
                        </button>
                        <button
                          onClick={() => {
                            alert('Scheduled to refresh data daily at 2:00 AM');
                            generateWorkflow(`Created daily schedule for dataset ${previewSource?.name}`, 'Data Engineering');
                          }}
                          className="px-2 py-1 rounded text-xs bg-emerald-900/50 text-emerald-200 hover:bg-emerald-800/60 border border-emerald-700/50 flex items-center gap-1"
                        >
                          Schedule
                        </button>
                      </div>
                      <label className="text-xs text-slate-400 flex items-center gap-1">
                        Rows/page
                        <select
                          value={tablePageSize}
                          onChange={(event) => setTablePageSize(Number(event.target.value))}
                          className="input-field py-1 px-2 text-xs"
                        >
                          {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => setTablePage(1)}
                        disabled={currentPage <= 1}
                        className="px-2 py-1 rounded text-xs bg-slate-800 text-slate-200 disabled:opacity-50"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setTablePage((previous) => Math.max(1, previous - 1))}
                        disabled={currentPage <= 1}
                        className="px-2 py-1 rounded text-xs bg-slate-800 text-slate-200 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <p className="text-xs text-slate-300">
                        Page {currentPage} / {tableTotalPages}
                      </p>
                      <button
                        onClick={() =>
                          setTablePage((previous) => Math.min(tableTotalPages, previous + 1))
                        }
                        disabled={currentPage >= tableTotalPages}
                        className="px-2 py-1 rounded text-xs bg-slate-800 text-slate-200 disabled:opacity-50"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setTablePage(tableTotalPages)}
                        disabled={currentPage >= tableTotalPages}
                        className="px-2 py-1 rounded text-xs bg-slate-800 text-slate-200 disabled:opacity-50"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                  <div
                    className="overflow-auto"
                    style={{ maxHeight: fullPageTable ? 'calc(100vh - 24rem)' : 'min(68vh, 860px)' }}
                  >
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-800">
                        <tr>
                          <th className="text-left p-2 w-10">
                            <input
                              type="checkbox"
                              checked={displayedRows.length > 0 && displayedRows.every((_, i) => selectedRowIndices.has(pageStartIndex + i))}
                              onChange={() => toggleAllRows(displayedRows.map((_, i) => pageStartIndex + i))}
                              className="rounded border-slate-600 bg-slate-800"
                            />
                          </th>
                          <th className="text-left p-2 text-slate-300 w-12">#</th>
                          <th className="text-left p-2 text-slate-300 w-16">Actions</th>
                          {tableColumns.map((column) => (
                            <th key={column} className="text-left p-2 text-slate-300">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.map((record, rowIndex) => {
                          const actualRowIndex = pageStartIndex + rowIndex;
                          const isSelected = selectedRowIndices.has(actualRowIndex);
                          const isDuplicate = duplicateRowIndices.has(actualRowIndex);
                          return (
                            <tr
                              key={`${previewSource.id}-row-${actualRowIndex}`}
                              className={`border-t border-slate-700/60 transition-colors ${isSelected ? 'bg-blue-900/20' :
                                isDuplicate ? 'bg-amber-900/50' : 'hover:bg-slate-800/30'
                                }`}
                            >
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRowSelection(actualRowIndex)}
                                  className="rounded border-slate-600 bg-slate-800"
                                />
                              </td>
                              <td className="p-2 text-slate-400">{actualRowIndex + 1}</td>
                              <td className="p-2">
                                <button
                                  onClick={() => handleEditRecord(actualRowIndex)}
                                  className="text-slate-400 hover:text-cyan-300"
                                  title="Edit Row"
                                >
                                  Edit
                                </button>
                              </td>
                              {tableColumns.map((column) => (
                                <td key={`${actualRowIndex}-${column}`} className="p-2 text-slate-200">
                                  {String(record[column] ?? '')}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {editingRowIndex !== null && editingRowData && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                      <div className="p-4 border-b border-slate-700/60 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-100">Edit Record (Row {editingRowIndex + 1})</h3>
                        <button
                          onClick={() => {
                            setEditingRowIndex(null);
                            setEditingRowData(null);
                          }}
                          className="text-slate-400 hover:text-slate-200"
                        >
                          ×
                        </button>
                      </div>
                      <div className="p-4 overflow-auto flex-1 space-y-3">
                        {tableColumns.map((column) => (
                          <div key={column} className="flex flex-col gap-1">
                            <label className="text-xs text-slate-400 font-medium">{column}</label>
                            <input
                              type="text"
                              value={editingRowData[column] ?? ''}
                              onChange={(e) => setEditingRowData({ ...editingRowData, [column]: e.target.value })}
                              className="input-field w-full text-sm"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="p-4 border-t border-slate-700/60 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingRowIndex(null);
                            setEditingRowData(null);
                          }}
                          className="px-4 py-2 rounded text-sm bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEditedRecord}
                          className="px-4 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-500"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {previewMode === 'hierarchy' && (
              <div className="space-y-3">
                <div className="p-3 rounded border border-slate-700/70 bg-slate-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-400">
                      Pick any number of columns to define the hierarchy path.
                    </p>
                    {hierarchyTree.length > 0 && (
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-slate-400">Export:</span>
                        <button
                          onClick={() => exportHierarchyResult('json')}
                          className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50"
                        >JSON</button>
                        <button
                          onClick={() => exportHierarchyResult('csv')}
                          className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50"
                        >CSV</button>
                        <button
                          onClick={() => exportHierarchyResult('xml')}
                          className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50"
                        >XML</button>
                        <button
                          onClick={() => exportHierarchyResult('xlsx')}
                          className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50"
                        >Excel</button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {previewSource.columns.map((column) => {
                      const selected = hierarchyColumns.includes(column);
                      return (
                        <button
                          key={column}
                          onClick={() => {
                            setHierarchyColumns((previous) => {
                              if (previous.includes(column)) {
                                return previous.filter((item) => item !== column);
                              }
                              return [...previous, column];
                            });
                          }}
                          className={`px-2 py-1 rounded text-xs ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                            }`}
                        >
                          {column}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="max-h-[360px] overflow-auto rounded border border-slate-700/70 p-3 bg-slate-900/50">
                  <HierarchyTree nodes={hierarchyTree} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderKpiSnapshotWidget = () => {
    if (!workspaceKpis) {
      return <p className="text-sm text-slate-400">Import datasets to compute KPIs.</p>;
    }

    const snapshotCards = [
      { cardId: 'snapshot-quality', helpId: 'quality_score', value: workspaceKpis.avgQualityScore, format: 'percent' as const },
      { cardId: 'snapshot-completeness', helpId: 'completeness', value: workspaceKpis.avgCompletenessPct, format: 'percent' as const },
      { cardId: 'snapshot-consistency', helpId: 'consistency', value: workspaceKpis.avgConsistencyPct, format: 'percent' as const },
      { cardId: 'snapshot-validity', helpId: 'validity', value: workspaceKpis.avgValidityPct, format: 'percent' as const },
      { cardId: 'snapshot-timeliness', helpId: 'timeliness', value: workspaceKpis.avgTimelinessPct, format: 'percent' as const },
      { cardId: 'snapshot-data-to-errors', helpId: 'data_to_errors_ratio', value: workspaceKpis.dataToErrorsRatio, format: 'ratio' as const },
      { cardId: 'snapshot-transform-errors', helpId: 'transformation_errors', value: workspaceKpis.totalTransformationErrors, format: 'count' as const },
      { cardId: 'snapshot-dark-data', helpId: 'dark_data', value: workspaceKpis.avgDarkDataPct, format: 'percent' as const },
      { cardId: 'snapshot-uniqueness', helpId: 'uniqueness', value: workspaceKpis.avgUniquenessPct, format: 'percent' as const },
      { cardId: 'snapshot-lineage', helpId: 'lineage', value: workspaceKpis.avgLineagePct, format: 'percent' as const },
      { cardId: 'snapshot-update-delay', helpId: 'data_update_delays', value: workspaceKpis.avgDataUpdateDelayHours, format: 'hours' as const },
      { cardId: 'snapshot-time-to-value', helpId: 'time_to_value', value: workspaceKpis.avgTimeToValueHours, format: 'hours' as const },
      { cardId: 'snapshot-email-bounce', helpId: 'email_bounce_rates', value: workspaceKpis.avgEmailBounceRatePct, format: 'percent' as const },
      { cardId: 'snapshot-pipeline', helpId: 'data_pipeline_incidents', value: workspaceKpis.totalPipelineIncidents, format: 'count' as const },
      { cardId: 'snapshot-storage', helpId: 'storage_costs', value: workspaceKpis.estimatedStorageCostUsd, format: 'currency' as const },
      { cardId: 'snapshot-coq', helpId: 'cost_of_quality', value: workspaceKpis.estimatedCostOfQualityUsd, format: 'currency' as const },
    ];

    return (
      <div className="space-y-3">
        {kpiAdviceError && <p className="text-xs text-amber-300">{kpiAdviceError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70">
            <p className="text-xs text-slate-400 uppercase">Datasets</p>
            <p className="text-2xl font-semibold text-slate-100">{workspaceKpis.datasets}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70">
            <p className="text-xs text-slate-400 uppercase">Views</p>
            <p className="text-2xl font-semibold text-slate-100">{activeWorkspace?.views.length || 0}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70">
            <p className="text-xs text-slate-400 uppercase">High Issues</p>
            <p className="text-2xl font-semibold text-red-300">{workspaceKpis.highSeverityIssues}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70">
            <p className="text-xs text-slate-400 uppercase">Known Errors</p>
            <p className="text-2xl font-semibold text-amber-300">
              {formatKpiValue(workspaceKpis.knownErrorCount, 'count')}
            </p>
          </div>
          {snapshotCards.map((card) =>
            renderKpiCard({
              ...card,
              scope: 'workspace',
            })
          )}
        </div>

        {datasetProfile && (
          <div className="p-3 rounded bg-blue-600/10 border border-blue-500/30">
            <p className="text-xs text-blue-300 uppercase">Active Source</p>
            <p className="text-sm text-slate-100 mb-2">{datasetProfile.datasetName}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {renderKpiCard({
                cardId: `snapshot-active-quality-${datasetProfile.datasetId}`,
                helpId: 'quality_score',
                value: datasetProfile.qualityScore,
                format: 'percent',
                scope: 'dataset',
              })}
              {renderKpiCard({
                cardId: `snapshot-active-data-to-errors-${datasetProfile.datasetId}`,
                helpId: 'data_to_errors_ratio',
                value: datasetProfile.dataToErrorsRatio,
                format: 'ratio',
                scope: 'dataset',
              })}
              {renderKpiCard({
                cardId: `snapshot-active-transform-${datasetProfile.datasetId}`,
                helpId: 'transformation_errors',
                value: datasetProfile.transformationErrorCount,
                format: 'count',
                scope: 'dataset',
              })}
              {renderKpiCard({
                cardId: `snapshot-active-update-delay-${datasetProfile.datasetId}`,
                helpId: 'data_update_delays',
                value: datasetProfile.dataUpdateDelayHours,
                format: 'hours',
                scope: 'dataset',
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWorkbenchWidget = (widgetId: WorkspaceWidgetId, fullPageTable = false) => {
    if (widgetId === 'importer') return renderImporterWidget();
    if (widgetId === 'datasets') return renderDatasetsWidget();
    if (widgetId === 'view_builder') return renderViewBuilderWidget();
    if (widgetId === 'data_viewer') return renderDataViewerWidget(fullPageTable);
    return renderKpiSnapshotWidget();
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Workspace Studio</h2>
        <p className="card-subtitle">
          Enterprise workspace for multi-file import, custom views, drag-and-drop layout, and multi-mode analysis
        </p>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row gap-3">
          <input
            type="text"
            className="input-field flex-1"
            placeholder="New workspace name"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') createWorkspace();
            }}
          />
          <button onClick={createWorkspace} className="btn-primary flex items-center justify-center gap-2">
            <FolderPlus className="w-4 h-4" />
            Create Workspace
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="flex items-center gap-1">
              <button
                onClick={() => {
                  setActiveWorkspaceId(workspace.id);
                  setError('');
                }}
                className={`px-3 py-2 rounded-lg text-sm ${workspace.id === activeWorkspaceId
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
              >
                {workspace.name}
              </button>
              <button
                onClick={() => removeWorkspace(workspace.id)}
                className="px-2 py-2 rounded-lg text-xs bg-slate-800 text-slate-400 hover:text-red-300 hover:bg-slate-700"
                title="Delete workspace"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {!activeWorkspace ? (
          <div className="text-slate-400 py-8 text-center">
            {loadingStorage ? 'Loading workspaces...' : 'Create a workspace to get started.'}
          </div>
        ) : (
          <>
            <div className="clay-morph-sm p-3 flex flex-wrap gap-2">
              {[
                { id: 'workbench', label: 'Workbench', icon: Rows3 },
                { id: 'profile', label: 'Quality Profile', icon: FileSpreadsheet },
                { id: 'profiling', label: 'Data Profiling', icon: Sparkles },
                { id: 'catalog', label: 'Data Catalog', icon: BookOpen },
                { id: 'kpis', label: 'KPI Dashboard', icon: BarChart3 },
                { id: 'graph', label: 'Knowledge Graph', icon: Network },
                { id: 'report', label: 'Export Report', icon: Download },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as WorkspaceTab)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'workbench' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/70 text-sm text-slate-300 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Drag cards by the grip icon and resize panels from the bottom handle.
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                  {(activeWorkspace.widgetLayout || DEFAULT_WIDGET_LAYOUT).map((widgetId) => {
                    const widget = WORKBENCH_WIDGETS[widgetId];
                    const widgetHeight = getWidgetHeight(widgetId);
                    const collapsed = getWidgetCollapsed(widgetId);
                    const fullPageTable =
                      widgetId === 'data_viewer' && !collapsed && previewMode === 'table';
                    return (
                      <div
                        key={widgetId}
                        draggable={!Boolean(resizingWidget)}
                        onDragStart={() => setDraggingWidget(widgetId)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => moveWidget(widgetId)}
                        className={`rounded-lg border border-slate-700/70 bg-slate-900/50 p-4 flex flex-col ${fullPageTable ? 'xl:col-span-2' : ''
                          }`}
                        style={
                          collapsed
                            ? { height: 'auto' }
                            : fullPageTable
                              ? { minHeight: 'calc(100vh - 260px)' }
                              : { height: widgetHeight }
                        }
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-medium text-slate-100">{widget.title}</p>
                            <p className="text-xs text-slate-400">{widget.subtitle}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {!fullPageTable && (
                              <span className="text-xs text-slate-500">{widgetHeight}px</span>
                            )}
                            <button
                              onClick={() => toggleWidgetCollapsed(widgetId)}
                              className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs flex items-center gap-1"
                            >
                              {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              {collapsed ? 'Expand' : 'Collapse'}
                            </button>
                            <GripVertical className="w-4 h-4 text-slate-500 cursor-move" />
                          </div>
                        </div>
                        {collapsed ? (
                          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                            Panel collapsed
                          </div>
                        ) : (
                          <>
                            <div
                              className={`flex-1 min-h-0 ${fullPageTable ? 'overflow-visible' : 'overflow-auto pr-1'
                                }`}
                            >
                              {renderWorkbenchWidget(widgetId, fullPageTable)}
                            </div>
                            {!fullPageTable && (
                              <div className="pt-2 mt-2 border-t border-slate-700/50 flex justify-end">
                                <button
                                  onMouseDown={(event) => startResizeWidget(widgetId, event)}
                                  className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 text-xs"
                                  title="Drag to resize panel"
                                >
                                  <MoveVertical className="w-3 h-3" />
                                  Resize
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-4">
                {!datasetProfile ? (
                  <div className="text-slate-400 text-center py-8">
                    Select an active dataset or view in Workbench Data Viewer.
                  </div>
                ) : (
                  <>
                    {kpiAdviceError && <p className="text-xs text-amber-300">{kpiAdviceError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      {[
                        {
                          cardId: `profile-quality-${datasetProfile.datasetId}`,
                          helpId: 'quality_score',
                          value: datasetProfile.qualityScore,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-table-health-${datasetProfile.datasetId}`,
                          helpId: 'table_health',
                          value: datasetProfile.tableHealthScore,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-accuracy-${datasetProfile.datasetId}`,
                          helpId: 'accuracy',
                          value: datasetProfile.accuracyPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-completeness-${datasetProfile.datasetId}`,
                          helpId: 'completeness',
                          value: datasetProfile.completenessPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-consistency-${datasetProfile.datasetId}`,
                          helpId: 'consistency',
                          value: datasetProfile.consistencyPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-validity-${datasetProfile.datasetId}`,
                          helpId: 'validity',
                          value: datasetProfile.validityPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-timeliness-${datasetProfile.datasetId}`,
                          helpId: 'timeliness',
                          value: datasetProfile.timelinessPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-data-to-errors-${datasetProfile.datasetId}`,
                          helpId: 'data_to_errors_ratio',
                          value: datasetProfile.dataToErrorsRatio,
                          format: 'ratio' as const,
                        },
                        {
                          cardId: `profile-empty-values-${datasetProfile.datasetId}`,
                          helpId: 'empty_values',
                          value: datasetProfile.emptyValueCount,
                          format: 'count' as const,
                        },
                        {
                          cardId: `profile-transform-errors-${datasetProfile.datasetId}`,
                          helpId: 'transformation_errors',
                          value: datasetProfile.transformationErrorCount,
                          format: 'count' as const,
                        },
                        {
                          cardId: `profile-dark-data-${datasetProfile.datasetId}`,
                          helpId: 'dark_data',
                          value: datasetProfile.darkDataPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-duplication-${datasetProfile.datasetId}`,
                          helpId: 'duplication',
                          value: datasetProfile.duplicationPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-uniqueness-${datasetProfile.datasetId}`,
                          helpId: 'uniqueness',
                          value: datasetProfile.uniquenessPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-lineage-${datasetProfile.datasetId}`,
                          helpId: 'lineage',
                          value: datasetProfile.lineagePct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-update-delay-${datasetProfile.datasetId}`,
                          helpId: 'data_update_delays',
                          value: datasetProfile.dataUpdateDelayHours,
                          format: 'hours' as const,
                        },
                        {
                          cardId: `profile-time-to-value-${datasetProfile.datasetId}`,
                          helpId: 'time_to_value',
                          value: datasetProfile.timeToValueHours,
                          format: 'hours' as const,
                        },
                        {
                          cardId: `profile-email-bounce-${datasetProfile.datasetId}`,
                          helpId: 'email_bounce_rates',
                          value: datasetProfile.emailBounceRatePct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `profile-pipeline-incidents-${datasetProfile.datasetId}`,
                          helpId: 'data_pipeline_incidents',
                          value: datasetProfile.pipelineIncidentCount,
                          format: 'count' as const,
                        },
                        {
                          cardId: `profile-storage-${datasetProfile.datasetId}`,
                          helpId: 'storage_costs',
                          value: datasetProfile.estimatedStorageCostUsd,
                          format: 'currency' as const,
                        },
                        {
                          cardId: `profile-cost-of-quality-${datasetProfile.datasetId}`,
                          helpId: 'cost_of_quality',
                          value: datasetProfile.costOfQualityUsd,
                          format: 'currency' as const,
                        },
                      ].map((item) =>
                        renderKpiCard({
                          ...item,
                          scope: 'dataset',
                        })
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-700/70">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-800">
                          <tr className="text-slate-300">
                            <th className="text-left p-3">Column</th>
                            <th className="text-left p-3">Type</th>
                            <th className="text-left p-3">Completeness</th>
                            <th className="text-left p-3">Uniqueness</th>
                            <th className="text-left p-3">Consistency</th>
                            <th className="text-left p-3">Validity</th>
                            <th className="text-left p-3">Null Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {datasetProfile.columnMetrics.map((metric) => (
                            <tr key={metric.column} className="border-t border-slate-700/60 text-slate-200">
                              <td className="p-3">{metric.column}</td>
                              <td className="p-3">{metric.inferredType}</td>
                              <td className="p-3">{metric.completenessPct.toFixed(1)}%</td>
                              <td className="p-3">{metric.uniquenessPct.toFixed(1)}%</td>
                              <td className="p-3">{metric.consistencyPct.toFixed(1)}%</td>
                              <td className="p-3">{metric.validityPct.toFixed(1)}%</td>
                              <td className="p-3">{metric.nullCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'profiling' && (
              <WorkspaceProfilingTab
                workspace={activeWorkspace}
                defaultFocusedDatasetId={activeDataset?.id}
                onOpenKnowledgeGraph={() => setActiveTab('graph')}
              />
            )}

            {activeTab === 'kpis' && (
              <div className="space-y-4">
                {!workspaceKpis ? (
                  <div className="text-slate-400 text-center py-8">No KPIs available.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-slate-100">Data Quality KPIs</h3>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-slate-400">Export:</span>
                        <button
                          onClick={() => exportKpisResult('json')}
                          className="px-2 py-1 flex items-center gap-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50 transition-colors"
                        >JSON</button>
                        <button
                          onClick={() => exportKpisResult('csv')}
                          className="px-2 py-1 flex items-center gap-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50 transition-colors"
                        >CSV</button>
                        <button
                          onClick={() => exportKpisResult('xml')}
                          className="px-2 py-1 flex items-center gap-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50 transition-colors"
                        >XML</button>
                        <button
                          onClick={() => exportKpisResult('xlsx')}
                          className="px-2 py-1 flex items-center gap-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600/50 transition-colors"
                        >Excel</button>
                      </div>
                    </div>
                    {kpiAdviceError && <p className="text-xs text-amber-300">{kpiAdviceError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/70">
                        <p className="text-xs text-slate-400 uppercase">Datasets</p>
                        <p className="text-2xl font-semibold text-slate-100 mt-1">{workspaceKpis.datasets}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/70">
                        <p className="text-xs text-slate-400 uppercase">Views</p>
                        <p className="text-2xl font-semibold text-slate-100 mt-1">
                          {activeWorkspace.views.length}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/70">
                        <p className="text-xs text-slate-400 uppercase">Total Rows</p>
                        <p className="text-2xl font-semibold text-slate-100 mt-1">
                          {formatKpiValue(workspaceKpis.totalRows, 'count')}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-800/60 border border-slate-700/70">
                        <p className="text-xs text-slate-400 uppercase">High Issues</p>
                        <p className="text-2xl font-semibold text-red-300 mt-1">
                          {workspaceKpis.highSeverityIssues}
                        </p>
                      </div>
                      {[
                        {
                          cardId: `kpis-quality-${activeWorkspace.id}`,
                          helpId: 'quality_score',
                          value: workspaceKpis.avgQualityScore,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-completeness-${activeWorkspace.id}`,
                          helpId: 'completeness',
                          value: workspaceKpis.avgCompletenessPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-consistency-${activeWorkspace.id}`,
                          helpId: 'consistency',
                          value: workspaceKpis.avgConsistencyPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-validity-${activeWorkspace.id}`,
                          helpId: 'validity',
                          value: workspaceKpis.avgValidityPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-timeliness-${activeWorkspace.id}`,
                          helpId: 'timeliness',
                          value: workspaceKpis.avgTimelinessPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-data-to-errors-${activeWorkspace.id}`,
                          helpId: 'data_to_errors_ratio',
                          value: workspaceKpis.dataToErrorsRatio,
                          format: 'ratio' as const,
                        },
                        {
                          cardId: `kpis-transform-errors-${activeWorkspace.id}`,
                          helpId: 'transformation_errors',
                          value: workspaceKpis.totalTransformationErrors,
                          format: 'count' as const,
                        },
                        {
                          cardId: `kpis-dark-data-${activeWorkspace.id}`,
                          helpId: 'dark_data',
                          value: workspaceKpis.avgDarkDataPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-uniqueness-${activeWorkspace.id}`,
                          helpId: 'uniqueness',
                          value: workspaceKpis.avgUniquenessPct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-lineage-${activeWorkspace.id}`,
                          helpId: 'lineage',
                          value: workspaceKpis.avgLineagePct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-update-delay-${activeWorkspace.id}`,
                          helpId: 'data_update_delays',
                          value: workspaceKpis.avgDataUpdateDelayHours,
                          format: 'hours' as const,
                        },
                        {
                          cardId: `kpis-time-to-value-${activeWorkspace.id}`,
                          helpId: 'time_to_value',
                          value: workspaceKpis.avgTimeToValueHours,
                          format: 'hours' as const,
                        },
                        {
                          cardId: `kpis-email-bounce-${activeWorkspace.id}`,
                          helpId: 'email_bounce_rates',
                          value: workspaceKpis.avgEmailBounceRatePct,
                          format: 'percent' as const,
                        },
                        {
                          cardId: `kpis-pipeline-${activeWorkspace.id}`,
                          helpId: 'data_pipeline_incidents',
                          value: workspaceKpis.totalPipelineIncidents,
                          format: 'count' as const,
                        },
                        {
                          cardId: `kpis-storage-${activeWorkspace.id}`,
                          helpId: 'storage_costs',
                          value: workspaceKpis.estimatedStorageCostUsd,
                          format: 'currency' as const,
                        },
                        {
                          cardId: `kpis-coq-${activeWorkspace.id}`,
                          helpId: 'cost_of_quality',
                          value: workspaceKpis.estimatedCostOfQualityUsd,
                          format: 'currency' as const,
                        },
                      ].map((item) =>
                        renderKpiCard({
                          ...item,
                          scope: 'workspace',
                        })
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70">
                      <p className="text-sm font-medium text-slate-200 mb-3">Dataset Quality Breakdown</p>
                      <div className="space-y-3">
                        {activeWorkspace.datasets.map((dataset) => {
                          const profile = buildDatasetProfile(dataset);
                          return (
                            <div key={dataset.id}>
                              <div className="flex justify-between text-xs text-slate-300 mb-1">
                                <span>{dataset.name}</span>
                                <span>{profile.qualityScore.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-slate-800 rounded">
                                <div
                                  className="h-2 bg-blue-500 rounded"
                                  style={{ width: `${Math.max(0, Math.min(100, profile.qualityScore))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {viewProfiles.length > 0 && (
                      <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700/70">
                        <p className="text-sm font-medium text-slate-200 mb-3">View Quality Breakdown</p>
                        <div className="space-y-3">
                          {viewProfiles.map(({ view, profile }) => (
                            <div key={view.id}>
                              <div className="flex justify-between text-xs text-slate-300 mb-1">
                                <span>{view.name}</span>
                                <span>{profile.qualityScore.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-slate-800 rounded">
                                <div
                                  className="h-2 bg-cyan-500 rounded"
                                  style={{ width: `${Math.max(0, Math.min(100, profile.qualityScore))}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/70 text-sm text-slate-300 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Graph includes datasets, columns, inferred key relationships, and shared fields.
                </div>
                <WorkspaceKnowledgeGraph workspace={activeWorkspace} />
                <p className="text-xs text-slate-500">
                  Nodes: {workspaceGraph.nodes.length} · Edges: {workspaceGraph.edges.length}
                </p>
              </div>
            )}

            {activeTab === 'report' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadText(`${activeWorkspace.name}-dq-report.md`, reportMarkdown, 'text/markdown')}
                    className="btn-primary"
                  >
                    Export Markdown
                  </button>
                  <button
                    onClick={() => downloadText(`${activeWorkspace.name}-dq-report.csv`, reportCsv, 'text/csv')}
                    className="btn-secondary"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() =>
                      downloadText(
                        `${activeWorkspace.name}-workspace.json`,
                        JSON.stringify(activeWorkspace, null, 2),
                        'application/json'
                      )
                    }
                    className="btn-success"
                  >
                    Export Workspace JSON
                  </button>
                  {previewDataset && (
                    <button
                      onClick={() =>
                        downloadText(
                          `${previewDataset.name}-tabular.csv`,
                          toCsv(previewDataset),
                          'text/csv'
                        )
                      }
                      className="btn-warning"
                    >
                      Export Active Source CSV
                    </button>
                  )}
                </div>
                <pre className="p-4 rounded-lg border border-slate-700/70 bg-slate-900/50 text-xs text-slate-200 whitespace-pre-wrap max-h-[520px] overflow-auto">
                  {reportMarkdown}
                </pre>
              </div>
            )}

            {activeTab === 'catalog' && (
              <WorkspaceCatalogTab
                workspace={activeWorkspace}
                onGenerateReport={() => setActiveTab('report')}
              />
            )}
          </>
        )}
      </div>

      {activeWorkspace && (
        <div className="fixed bottom-4 right-4 z-50 w-[min(420px,calc(100vw-2rem))]">
          {chatOpen ? (
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/95 backdrop-blur shadow-2xl h-[420px] flex flex-col">
              <div className="px-3 py-2 border-b border-slate-700/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 font-medium">Data Chat</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {previewSource ? `Source: ${previewSource.name}` : 'Select a dataset or view to start'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="px-2 py-1 rounded text-xs bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  Collapse
                </button>
              </div>

              <div className="flex-1 overflow-auto p-3 space-y-2">
                {chatMessages.length === 0 ? (
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>Ask questions like:</p>
                    <p className="text-slate-500">• how many rows?</p>
                    <p className="text-slate-500">• show columns</p>
                    <p className="text-slate-500">• nulls in email</p>
                    <p className="text-slate-500">• top values in country</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${message.role === 'user'
                        ? 'bg-blue-600/30 border border-blue-500/40 text-blue-50 ml-6'
                        : 'bg-slate-800 border border-slate-700/70 text-slate-200 mr-6'
                        }`}
                    >
                      {message.text}
                    </div>
                  ))
                )}
                {chatResponding && <p className="text-xs text-slate-400">Thinking...</p>}
              </div>

              <div className="p-3 border-t border-slate-700/70">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    className="input-field flex-1 py-2 text-sm"
                    placeholder="Ask about this dataset/view..."
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={chatResponding || chatInput.trim().length === 0}
                    className="px-3 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-60"
                  >
                    <SendHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setChatOpen(true)}
              className="ml-auto flex items-center gap-2 rounded-full px-4 py-3 bg-cyan-600 text-white shadow-lg hover:bg-cyan-500"
            >
              <MessageSquare className="w-4 h-4" />
              Data Chat
            </button>
          )}
        </div>
      )}
      {inspectingKpiIssue && activeWorkspace && (
        <KpiIssueDrilldownModal
          helpId={inspectingKpiIssue.helpId}
          scope={inspectingKpiIssue.scope}
          datasets={activeWorkspace.datasets}
          activeDatasetId={activeDataset?.id}
          onClose={() => setInspectingKpiIssue(null)}
        />
      )}
    </div>
  );
}
