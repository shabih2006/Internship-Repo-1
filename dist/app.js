import express from 'express';
const students = [];
const app = express();
const PORT = 3000;
app.use(express.json());
app.get('/', (req, res) => {
    res.send('Server is up and running!');
});
app.post('/students', (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: 'Invalid student name (must be a string)' });
    }
    const newStudent = {
        id: students.length + 1,
        name: name.trim()
    };
    students.push(newStudent);
    res.status(201).json(newStudent);
});
app.listen(PORT, () => {
    console.log('Server started on http://localhost:' + PORT);
});
