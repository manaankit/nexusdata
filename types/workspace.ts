export type SupportedImportFormat =
  | 'csv'
  | 'xlsx'
  | 'xls'
  | 'sql'
  | 'docx'
  | 'pdf'
  | 'parquet'
  | 'txt'
  | 'json';

export type DatasetKind = 'tabular' | 'text' | 'sql';

export interface ImportedDataset {
  id: string;
  name: string;
  fileName: string;
  format: SupportedImportFormat | 'unknown';
  kind: DatasetKind;
  sourceSheet?: string;
  rowCount: number;
  columns: string[];
  records: Record<string, unknown>[];
  parseWarnings: string[];
  importedAt: string;
}

export type WorkspaceSourceType = 'dataset' | 'view';

export interface DataViewColumn {
  id: string;
  datasetId: string;
  sourceColumn: string;
  alias: string;
}

export type DataViewCombineMode = 'row_index' | 'join_by_key';

export interface ViewJoinTarget {
  id: string;
  datasetId: string;
  keyColumn: string;
}

export type DataViewJoinType = 'inner' | 'left' | 'full';
export type DataViewOneToManyMode = 'expand' | 'first_match';

export interface WorkspaceViewJoinConfig {
  baseDatasetId: string;
  baseKeyColumn: string;
  joinType: DataViewJoinType;
  oneToManyMode: DataViewOneToManyMode;
  joins: ViewJoinTarget[];
}

export interface WorkspaceDataView {
  id: string;
  name: string;
  description?: string;
  combineMode: DataViewCombineMode;
  joinConfig?: WorkspaceViewJoinConfig;
  columns: DataViewColumn[];
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceWidgetId =
  | 'importer'
  | 'datasets'
  | 'view_builder'
  | 'data_viewer'
  | 'kpi_snapshot';

export interface WorkspaceSqlHistoryEntry {
  id: string;
  query: string;
  sourceType: WorkspaceSourceType;
  sourceId?: string;
  sourceName: string;
  rowCount: number;
  executedAt: string;
}

export interface WorkspaceSqlSnippet {
  id: string;
  name: string;
  query: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceWorkflow {
  id: string;
  title: string;
  assignedTo: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  datasets: ImportedDataset[];
  views: WorkspaceDataView[];
  widgetLayout?: WorkspaceWidgetId[];
  widgetSizes?: Partial<Record<WorkspaceWidgetId, number>>;
  collapsedWidgets?: Partial<Record<WorkspaceWidgetId, boolean>>;
  activeDatasetId?: string;
  activeViewId?: string;
  sqlHistory?: WorkspaceSqlHistoryEntry[];
  sqlSnippets?: WorkspaceSqlSnippet[];
  workflows?: WorkspaceWorkflow[];
}

export interface ColumnQualityMetric {
  column: string;
  inferredType: 'numeric' | 'date' | 'boolean' | 'text' | 'mixed';
  completenessPct: number;
  uniquenessPct: number;
  consistencyPct: number;
  validityPct: number;
  nullCount: number;
  uniqueCount: number;
}

export interface DataQualityIssue {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  column?: string;
}

export interface DatasetProfile {
  datasetId: string;
  datasetName: string;
  rowCount: number;
  columnCount: number;
  totalCellCount: number;
  knownErrorCount: number;
  dataToErrorsRatio: number;
  emptyValueCount: number;
  transformationErrorCount: number;
  darkDataPct: number;
  estimatedStorageCostUsd: number;
  timeToValueHours: number;
  emailBounceRatePct: number;
  costOfQualityUsd: number;
  dataUpdateDelayHours: number;
  pipelineIncidentCount: number;
  tableHealthScore: number;
  accuracyPct: number;
  validityPct: number;
  timelinessPct: number;
  duplicationPct: number;
  lineagePct: number;
  duplicateRowPct: number;
  completenessPct: number;
  uniquenessPct: number;
  consistencyPct: number;
  qualityScore: number;
  columnMetrics: ColumnQualityMetric[];
  issues: DataQualityIssue[];
}

export interface WorkspaceKpis {
  workspaceId: string;
  workspaceName: string;
  datasets: number;
  totalRows: number;
  totalCellCount: number;
  knownErrorCount: number;
  dataToErrorsRatio: number;
  totalEmptyValues: number;
  totalTransformationErrors: number;
  avgDarkDataPct: number;
  estimatedStorageCostUsd: number;
  avgTimeToValueHours: number;
  avgEmailBounceRatePct: number;
  estimatedCostOfQualityUsd: number;
  avgDataUpdateDelayHours: number;
  totalPipelineIncidents: number;
  avgTableHealthScore: number;
  avgQualityScore: number;
  avgAccuracyPct: number;
  avgCompletenessPct: number;
  avgUniquenessPct: number;
  avgConsistencyPct: number;
  avgValidityPct: number;
  avgTimelinessPct: number;
  avgDuplicationPct: number;
  avgLineagePct: number;
  highSeverityIssues: number;
  mediumSeverityIssues: number;
  lowSeverityIssues: number;
}

export interface WorkspaceGraphNode {
  id: string;
  label: string;
  type: 'dataset' | 'column';
}

export interface WorkspaceGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: 'contains' | 'inferred_fk' | 'shared_field';
}

export interface WorkspaceGraph {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
}
