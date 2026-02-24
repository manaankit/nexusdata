from db_connector import DBConnector

class SchemaAnalyzer:
    def __init__(self, db_connector):
        self.db_connector = db_connector

    def analyze_schema(self):
        schema = self.db_connector.get_schema()
        relationships = []
        for table, columns in schema.items():
            for column in columns:
                if "_id" in column[1]:  # Assuming foreign key naming convention
                    relationships.append((table, column[1]))
        return schema, relationships
