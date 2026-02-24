from db_connector import DBConnector
from schema_analyzer import SchemaAnalyzer
from knowledge_graph import KnowledgeGraph
from report_generator import ReportGenerator

def main():
    db_path = "your_database_path_here.db"  # Replace with your database path

    # Step 1: Connect to the database
    db_connector = DBConnector(db_path)
    db_connector.connect()

    # Step 2: Analyze the schema
    schema_analyzer = SchemaAnalyzer(db_connector)
    schema, relationships = schema_analyzer.analyze_schema()

    # Step 3: Create a knowledge graph
    knowledge_graph = KnowledgeGraph(schema, relationships)
    knowledge_graph.create_graph()

    # Step 4: Generate a report
    report_generator = ReportGenerator(schema, relationships)
    report_generator.generate_report()

    # Step 5: Close the database connection
    db_connector.close()

if __name__ == "__main__":
    main()
