from flask import Flask, render_template, request, redirect, url_for, session
from db_connector import DBConnector
from schema_analyzer import SchemaAnalyzer
from knowledge_graph import KnowledgeGraph
from report_generator import ReportGenerator

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Replace with a secure key

# Placeholder for user data (use a database in production)
users = {
    "admin": {"password": "admin123", "role": "admin"}
}

@app.route('/')
def home():
    if 'username' in session:
        return render_template('dashboard.html', username=session['username'], role=session['role'])
    return render_template('login.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if username in users and users[username]['password'] == password:
            session['username'] = username
            session['role'] = users[username]['role']
            return redirect(url_for('home'))
        return "Invalid credentials!"
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('username', None)
    session.pop('role', None)
    return redirect(url_for('home'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if username not in users:
            users[username] = {"password": password, "role": "user"}
            return redirect(url_for('login'))
        return "User already exists!"
    return render_template('register.html')

@app.route('/admin')
def admin():
    if 'username' in session and session['role'] == 'admin':
        return render_template('admin.html')
    return redirect(url_for('home'))

@app.route('/setup_database', methods=['POST'])
def setup_database():
    if 'username' in session and session['role'] == 'admin':
        db_path = request.form['db_path']
        db_connector = DBConnector(db_path)
        db_connector.connect()
        schema_analyzer = SchemaAnalyzer(db_connector)
        schema, relationships = schema_analyzer.analyze_schema()
        db_connector.close()
        return "Database setup complete!"
    return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True)
