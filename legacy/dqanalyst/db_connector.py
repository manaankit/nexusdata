import sqlite3

class DBConnector:
    def __init__(self, db_path):
        self.db_path = db_path
        self.connection = None

    def connect(self):
        try:
            self.connection = sqlite3.connect(self.db_path)
            print("Database connection successful.")
        except sqlite3.Error as e:
            print(f"Error connecting to database: {e}")

    def get_schema(self):
        if not self.connection:
            raise Exception("Database not connected.")
        cursor = self.connection.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        schema = {}
        for table in tables:
            table_name = table[0]
            cursor.execute(f"PRAGMA table_info({table_name});")
            schema[table_name] = cursor.fetchall()
        return schema

    def close(self):
        if self.connection:
            self.connection.close()
            print("Database connection closed.")
