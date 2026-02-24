import csv

class ReportGenerator:
    def __init__(self, schema, relationships):
        self.schema = schema
        self.relationships = relationships

    def generate_report(self, output_file="schema_report.csv"):
        with open(output_file, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(["Table", "Column", "Type", "Relationships"])
            for table, columns in self.schema.items():
                for column in columns:
                    relationship = "Yes" if any(table == rel[0] and column[1] in rel[1] for rel in self.relationships) else "No"
                    writer.writerow([table, column[1], column[2], relationship])
        print(f"Report generated and saved to {output_file}.")
