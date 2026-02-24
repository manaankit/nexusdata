from pyvis.network import Network

class KnowledgeGraph:
    def __init__(self, schema, relationships):
        self.schema = schema
        self.relationships = relationships

    def create_graph(self, output_file="knowledge_graph.html"):
        net = Network()
        for table in self.schema.keys():
            net.add_node(table, label=table)
        for relationship in self.relationships:
            net.add_edge(relationship[0], relationship[1].replace("_id", ""))
        net.show(output_file)
        print(f"Knowledge graph saved to {output_file}.")
