# nexusdata
An enterprise-grade, local-first Data Quality Dashboard. Features multi-dataset profiling, dynamic relationship discovery, customizable validation rules, and interactive KPI drilldowns. Built with React and Tailwind, offering a powerful, fluid workspace for data stewards and engineers.

## Features & Capabilities

### 1. Unified Workspace Studio
A specialized environment tailored for data stewards and engineers to manage datasets.
* **Multi-Format Ingestion**: Import data from CSV, Excel (`.xlsx`, `.xls`), JSON, Parquet, SQL scripts, PDF, DOCX, and Text files.
* **Layout Management**: Fully resizable and draggable widget layout to customize your workspace view using `react-grid-layout`.

### 2. Data Editor & Viewer
* **Tabular & Hierarchical Views**: Toggle between standard data grids or hierarchical tree views (built using `react-arborist` and `d3-org-chart`).
* **Record Management**: 
  * Select single or multiple rows for bulk deletion.
  * Individual record editing using a detailed edit modal.
* **Duplicate Detection**: Instantly highlight and identify duplicate records within the active dataset.
* **Automated Scheduling**: Generate engineering workflows and data-refresh schedules directly from the viewer.

### 3. Data Profiling & Classification
* **Comprehensive Metrics**: Automatic computation of dataset completeness, uniqueness, consistency, valid formats, missing values, and high-severity issues.
* **Data Classification**: Option to execute intelligent metadata classification and PII-tagging scans on any imported dataset.
* **KPI Dashboard**: A visual dashboard reporting workspace-level health across 15+ metrics (Quality Score, Completeness, Consistency, etc.).

### 4. Interactive KPI Drilldown
* **Root Cause Analysis**: Click "Inspect Records" on active KPI issues (like Transformation Errors or Empty Values) to immediately view the exact problematic records causing the issue.
* **Exportable Reports**: Download these isolated, problematic rows into a CSV report directly from the drilldown modal for offline remediation.

### 5. Data Catalog & Metadata
* **Catalog Tabs**: Complete enterprise data cataloging including Data Sources, Glossary, Report Catalog, ERDs, Data Products, and Badges.
* **Knowledge Graph**: Auto-generated interactive knowledge graphs mapping foreign keys and shared semantic fields across all imported datasets.

### 6. Export Capabilities
* **Flexible Formats**: Export datasets, hierarchical views, and generated quality reports in **CSV**, **JSON**, **XML**, and **Excel (.xlsx)** formats.
* **Intelligent Hierarchies**: Export hierarchical data maintaining tree-like layouts in spreadsheets for executive reporting.

---

## How to Use

### Setup & Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables:
   Copy `.env.example` to `.env.local` and configure your Supabase URL, Anon Key, and any necessary AI Provider keys (e.g. OpenAI).
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000)

### Basic Workflow
1. **Create a Workspace**: Navigate to the Workspace Studio and create a new workspace container.
2. **Import Data**: Use the Data Importer pane to drag-and-drop your dataset files (CSV, Excel, etc.).
3. **Profile & Catalog**: Run Data Classification on the imported datasets to populate the Data Catalog and Data Profiling views.
4. **Edit & Clean**: Open the Data Editor to remove duplicates, correct specific row values, and delete bad records.
5. **Analyze KPIs**: Navigate to the KPIs tab to view the aggregated dashboard. Drill down into any metric under "Active Source" to see what rows are lowering your score.
6. **Export**: Export the cleaned dataset, the Knowledge Graph, or the Quality Report in your preferred format (XML, CSV, XLSX).

---

## Key Endpoints
* `POST /api/workspaces/parse-file`
* `GET /api/database/metadata/:connectionId`
* `GET /api/knowledge-graph/:connectionId`
* `POST /api/ai/recommendations`
* `GET /api/database-connections`

## Legacy Python Notes
Original DQAnalyst Python scripts (for advanced schema analysis and relationships) are preserved in `legacy/dqanalyst/` for compatibility and custom enterprise reference.
