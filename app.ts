export {};
import express, {Request,Response} from 'express';
interface Student {
    id: number;
    name: string;
}

const students: Student[] = [];

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
res.send('Server is up and running!');
});

app.post('/students', (req: Request, res: Response) => {
const { name } = req.body;

if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Invalid student name (must be a string)' });
}

const newStudent: Student = {
    id: students.length + 1,
    name: name.trim()
};

students.push(newStudent);

res.status(201).json(newStudent);
});

app.listen(PORT, () => {
console.log('Server started on http://localhost:' + PORT);
});