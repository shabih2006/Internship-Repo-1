export {};
import express, { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

interface Student {
  id: number;
  name: string;
}

const students: Student[] = [];

const app = express();
const PORT = 3000;

app.use(express.json());

// ==========================================
// LIVE TERMINAL REQUEST LOGGER
// ==========================================
app.use((req: Request, res: Response, next: NextFunction) => {
  const time = new Date().toLocaleTimeString();
  console.log(`\n--------------------------------------------------`);
  console.log(`[${time}] INCOMING: ${req.method} ${req.originalUrl}`);
  if (Object.keys(req.body).length > 0) {
    console.log(`Body:`, JSON.stringify(req.body));
  }
  next();
});

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

const createStudentSchema = z.object({
  id: z
    .number({ message: 'ID must be a number' })
    .int('ID must be an integer')
    .positive('ID must be a positive number')
    .optional(),
  name: z
    .string({ message: 'Student name must be a string' })
    .trim()
    .min(1, 'Student name cannot be empty')
});

const updateStudentSchema = z.object({
  id: z
    .number({ message: 'New ID must be a number' })
    .int('New ID must be an integer')
    .positive('New ID must be a positive number')
    .optional(),
  name: z
    .string({ message: 'Student name must be a string' })
    .trim()
    .min(1, 'Student name cannot be empty')
});

const patchStudentSchema = z.object({
  id: z
    .number({ message: 'New ID must be a number' })
    .int('New ID must be an integer')
    .positive('New ID must be a positive number')
    .optional(),
  name: z
    .string({ message: 'Name must be a string' })
    .trim()
    .min(1, 'Student name cannot be empty')
    .optional()
});

// Middleware Factory for Body Validation
const validateBody = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Helper: Validate Route ID Parameter
const parseAndValidateParamId = (req: Request, res: Response): number | null => {
  const studentId = parseInt(String(req.params.id), 10);
  if (isNaN(studentId) || studentId <= 0) {
    console.log(`INVALID PARAM ID: ${req.params.id}`);
    res.status(400).json({ error: 'Invalid student ID format in URL path.' });
    return null;
  }
  return studentId;
};

// ==========================================
// ROUTES
// ==========================================

// 1. BASE ENDPOINT
app.get('/', (req: Request, res: Response) => {
  console.log(`RESPONSE: 200 OK - Health Check`);
  res.send('Server is up and running!');
});

// 2. CREATE STUDENT (POST /students)
app.post('/students', validateBody(createStudentSchema), (req: Request, res: Response) => {
  const { id, name } = req.body;

  let studentId: number;

  if (id !== undefined) {
    const exists = students.some((s) => s.id === id);
    if (exists) {
      console.log(`DUPLICATE ID ERROR: Student ${id} already exists`);
      res.status(400).json({ error: 'Student with ID ' + id + ' already exists.' });
      return;
    }
    studentId = id;
  } else {
    studentId = students.length > 0 ? Math.max(...students.map((s) => s.id)) + 1 : 1;
  }

  const newStudent: Student = {
    id: studentId,
    name: name
  };

  students.push(newStudent);
  console.log(`CREATED:`, newStudent);
  res.status(201).json(newStudent);
});

// 3. READ ALL STUDENTS (GET /students)
app.get('/students', (req: Request, res: Response) => {
  console.log(`FETCHED ALL: ${students.length} student(s) found`);
  res.status(200).json(students);
});

// 4. READ SINGLE STUDENT (GET /students/:id)
app.get('/students/:id', (req: Request, res: Response) => {
  const studentId = parseAndValidateParamId(req, res);
  if (studentId === null) return;

  const foundStudent = students.find((s) => s.id === studentId);

  if (!foundStudent) {
    console.log(`NOT FOUND: Student ID ${studentId}`);
    res.status(404).json({ error: 'Student with ID ' + studentId + ' not found.' });
    return;
  }

  console.log(`FETCHED SINGLE:`, foundStudent);
  res.status(200).json(foundStudent);
});

// 5. UPDATE STUDENT - FULL (PUT /students/:id)
app.put('/students/:id', validateBody(updateStudentSchema), (req: Request, res: Response) => {
  const currentId = parseAndValidateParamId(req, res);
  if (currentId === null) return;

  const { id: newId, name } = req.body;
  const studentIndex = students.findIndex((s) => s.id === currentId);

  if (studentIndex === -1) {
    console.log(`NOT FOUND FOR UPDATE: Student ID ${currentId}`);
    res.status(404).json({ error: 'Student with ID ' + currentId + ' not found.' });
    return;
  }

  let updatedId = currentId;

  if (newId !== undefined && newId !== currentId) {
    const idExists = students.some((s) => s.id === newId);
    if (idExists) {
      console.log(`DUPLICATE ID ERROR: ID ${newId} already taken`);
      res.status(400).json({ error: 'Student with ID ' + newId + ' already exists.' });
      return;
    }
    updatedId = newId;
  }

  students[studentIndex] = {
    id: updatedId,
    name: name
  };

  console.log(`PUT UPDATED:`, students[studentIndex]);
  res.status(200).json(students[studentIndex]);
});

// 6. UPDATE STUDENT - PARTIAL (PATCH /students/:id)
app.patch('/students/:id', validateBody(patchStudentSchema), (req: Request, res: Response) => {
  const currentId = parseAndValidateParamId(req, res);
  if (currentId === null) return;

  const { id: newId, name } = req.body;
  const student = students.find((s) => s.id === currentId);

  if (!student) {
    console.log(`NOT FOUND FOR PATCH: Student ID ${currentId}`);
    res.status(404).json({ error: 'Student with ID ' + currentId + ' not found.' });
    return;
  }

  if (newId !== undefined && newId !== currentId) {
    const idExists = students.some((s) => s.id === newId);
    if (idExists) {
      console.log(`DUPLICATE ID ERROR: ID ${newId} already taken`);
      res.status(400).json({ error: 'Student with ID ' + newId + ' already exists.' });
      return;
    }
    student.id = newId;
  }

  if (name !== undefined) {
    student.name = name;
  }

  console.log(`PATCH UPDATED:`, student);
  res.status(200).json(student);
});

// 7. DELETE STUDENT (DELETE /students/:id)
app.delete('/students/:id', (req: Request, res: Response) => {
  const studentId = parseAndValidateParamId(req, res);
  if (studentId === null) return;

  const studentIndex = students.findIndex((s) => s.id === studentId);

  if (studentIndex === -1) {
    console.log(`NOT FOUND FOR DELETE: Student ID ${studentId}`);
    res.status(404).json({ error: 'Student with ID ' + studentId + ' not found.' });
    return;
  }

  const deletedStudent = students.splice(studentIndex, 1)[0];

  console.log(`DELETED:`, deletedStudent);
  res.status(200).json({
    message: 'Student deleted successfully.',
    deletedStudent: deletedStudent
  });
});

// ==========================================
// CENTRALIZED ERROR & 404 LOGGERS
// ==========================================

// Catch-all for undefined routes
app.use((req: Request, res: Response) => {
  console.log(`404 NOT FOUND: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route ' + req.originalUrl + ' not found on this server.' });
});

// Centralized Express Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    const errorMessages = err.issues.map((e) => e.message);
    console.log(`ZOD VALIDATION FAILED:`, errorMessages);
    res.status(400).json({
      error: 'Validation Failed',
      details: errorMessages
    });
    return;
  }

  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    console.log(`MALFORMED JSON BODY DETECTED`);
    res.status(400).json({ error: 'Invalid JSON payload sent in request body.' });
    return;
  }

  console.error('UNHANDLED SERVER CRASH:', err);
  res.status(500).json({ error: 'Internal Server Error.' });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`==================================================`);
});