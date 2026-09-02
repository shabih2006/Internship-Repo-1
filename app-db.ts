export {};
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to safely locate Prisma models dynamically
const getModel = (modelName: string) => {
  const p = prisma as any;
  const target = modelName.toLowerCase();
  
  const keys = Object.keys(p);
  const foundKey = keys.find((k) => k.toLowerCase() === target);

  return foundKey ? p[foundKey] : null;
};

// Terminal Request Logger Middleware
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

const studentSchema = z.object({
  StudentID: z.number({ message: 'StudentID must be a number' }).int().positive(),
  StudentName: z.string({ message: 'StudentName must be a string' }).trim().min(1, 'StudentName cannot be empty'),
  PhoneNo: z.string().optional(),
  DOB: z.string().optional(),
  Email: z.string().email('Invalid email address format').optional()
});

const teacherSchema = z.object({
  TeacherID: z.number({ message: 'TeacherID must be a number' }).int().positive(),
  TeacherName: z.string({ message: 'TeacherName must be a string' }).trim().min(1, 'TeacherName cannot be empty'),
  Email: z.string().email('Invalid email address format').optional(),
  PhoneNo: z.string().optional()
});

const courseSchema = z.object({
  CourseID: z.number({ message: 'CourseID must be a number' }).int().positive(),
  CourseNmae: z.string({ message: 'CourseNmae must be a string' }).trim().min(1, 'CourseNmae cannot be empty'),
  CreditHours: z.number().int().positive().optional(),
  TeacherID: z.number().int().positive().optional()
});

const enrollmentSchema = z.object({
  EnrollmentID: z.number({ message: 'EnrollmentID must be a number' }).int().positive(),
  StudentID: z.number({ message: 'StudentID must be a number' }).int().positive(),
  CourseID: z.number({ message: 'CourseID must be a number' }).int().positive(),
  EnrollmentDate: z.string().optional()
});

const resultSchema = z.object({
  ResultID: z.number({ message: 'ResultID must be a number' }).int().positive(),
  EnrollmentID: z.number({ message: 'EnrollmentID must be a number' }).int().positive(),
  Grade: z.string().trim().max(5, 'Grade max length is 5').optional(),
  GPA: z.number().min(0.0).max(4.0, 'GPA must be between 0.0 and 4.0').optional()
});

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

const parseId = (req: Request, res: Response): number | null => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid ID format in URL path.' });
    return null;
  }
  return id;
};

// ==========================================
// 1. STUDENT ROUTES
// ==========================================
app.get('/students', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentModel = getModel('Student');
    if (studentModel) {
      const data = await studentModel.findMany({ include: { Enrollment: true } });
      res.status(200).json(data);
    } else {
      const data = await prisma.$queryRawUnsafe(`SELECT * FROM Student;`);
      res.status(200).json(data);
    }
  } catch (err) { next(err); }
});

app.post('/students', validateBody(studentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { StudentID, StudentName, PhoneNo, DOB, Email } = req.body;
    const studentModel = getModel('Student');

    if (studentModel) {
      const existing = await studentModel.findUnique({ where: { StudentID } });
      if (existing) {
        res.status(400).json({ error: `Student with ID ${StudentID} already exists.` });
        return;
      }
      const newRecord = await studentModel.create({ data: req.body });
      res.status(201).json(newRecord);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO Student (StudentID, StudentName, PhoneNo, DOB, Email) VALUES (?, ?, ?, ?, ?)`,
        StudentID, StudentName, PhoneNo || null, DOB || null, Email || null
      );
      res.status(201).json(req.body);
    }
  } catch (err) { next(err); }
});

app.delete('/students/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const studentModel = getModel('Student');
    if (studentModel) {
      const deleted = await studentModel.delete({ where: { StudentID: id } });
      res.status(200).json({ message: 'Student deleted successfully', deleted });
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM Student WHERE StudentID = ?;`, id);
      res.status(200).json({ message: 'Student deleted successfully', StudentID: id });
    }
  } catch (err) { next(err); }
});

// ==========================================
// 2. TEACHER ROUTES
// ==========================================
app.get('/teachers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherModel = getModel('Teacher');
    if (teacherModel) {
      const data = await teacherModel.findMany({ include: { Courses: true } });
      res.status(200).json(data);
    } else {
      const data = await prisma.$queryRawUnsafe(`SELECT * FROM Teacher;`);
      res.status(200).json(data);
    }
  } catch (err) { next(err); }
});

app.post('/teachers', validateBody(teacherSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { TeacherID, TeacherName, Email, PhoneNo } = req.body;
    const teacherModel = getModel('Teacher');

    if (teacherModel) {
      const existing = await teacherModel.findUnique({ where: { TeacherID } });
      if (existing) {
        res.status(400).json({ error: `Teacher with ID ${TeacherID} already exists.` });
        return;
      }
      const newRecord = await teacherModel.create({ data: req.body });
      console.log(`CREATED TEACHER:`, newRecord);
      res.status(201).json(newRecord);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO Teacher (TeacherID, TeacherName, Email, PhoneNo) VALUES (?, ?, ?, ?)`,
        TeacherID, TeacherName, Email || null, PhoneNo || null
      );
      console.log(`CREATED TEACHER (RAW SQL):`, req.body);
      res.status(201).json(req.body);
    }
  } catch (err) { next(err); }
});

app.delete('/teachers/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const teacherModel = getModel('Teacher');
    if (teacherModel) {
      const deleted = await teacherModel.delete({ where: { TeacherID: id } });
      res.status(200).json({ message: 'Teacher deleted successfully', deleted });
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM Teacher WHERE TeacherID = ?;`, id);
      res.status(200).json({ message: 'Teacher deleted successfully', TeacherID: id });
    }
  } catch (err) { next(err); }
});

// ==========================================
// 3. COURSES ROUTES
// ==========================================
app.get('/courses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseModel = getModel('Courses');
    if (courseModel) {
      const data = await courseModel.findMany({ include: { Teacher: true, Enrollment: true } });
      res.status(200).json(data);
    } else {
      const data = await prisma.$queryRawUnsafe(`SELECT * FROM Courses;`);
      res.status(200).json(data);
    }
  } catch (err) { next(err); }
});

app.post('/courses', validateBody(courseSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { CourseID, CourseNmae, CreditHours, TeacherID } = req.body;
    const courseModel = getModel('Courses');

    if (courseModel) {
      const existing = await courseModel.findUnique({ where: { CourseID } });
      if (existing) {
        res.status(400).json({ error: `Course with ID ${CourseID} already exists.` });
        return;
      }
      const newRecord = await courseModel.create({ data: req.body });
      res.status(201).json(newRecord);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO Courses (CourseID, CourseNmae, CreditHours, TeacherID) VALUES (?, ?, ?, ?)`,
        CourseID, CourseNmae, CreditHours || null, TeacherID || null
      );
      res.status(201).json(req.body);
    }
  } catch (err) { next(err); }
});

app.delete('/courses/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const courseModel = getModel('Courses');
    if (courseModel) {
      const deleted = await courseModel.delete({ where: { CourseID: id } });
      res.status(200).json({ message: 'Course deleted successfully', deleted });
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM Courses WHERE CourseID = ?;`, id);
      res.status(200).json({ message: 'Course deleted successfully', CourseID: id });
    }
  } catch (err) { next(err); }
});

// ==========================================
// 4. ENROLLMENT ROUTES
// ==========================================
app.get('/enrollments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enrollmentModel = getModel('Enrollment');
    if (enrollmentModel) {
      const data = await enrollmentModel.findMany({
        include: { Student: true, Courses: true, Results: true }
      });
      res.status(200).json(data);
    } else {
      const data = await prisma.$queryRawUnsafe(`SELECT * FROM Enrollment;`);
      res.status(200).json(data);
    }
  } catch (err) { next(err); }
});

app.post('/enrollments', validateBody(enrollmentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { EnrollmentID, StudentID, CourseID, EnrollmentDate } = req.body;
    const enrollmentModel = getModel('Enrollment');

    if (enrollmentModel) {
      const existing = await enrollmentModel.findUnique({ where: { EnrollmentID } });
      if (existing) {
        res.status(400).json({ error: `Enrollment with ID ${EnrollmentID} already exists.` });
        return;
      }
      const newRecord = await enrollmentModel.create({ data: req.body });
      res.status(201).json(newRecord);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO Enrollment (EnrollmentID, StudentID, CourseID, EnrollmentDate) VALUES (?, ?, ?, ?)`,
        EnrollmentID, StudentID, CourseID, EnrollmentDate || null
      );
      res.status(201).json(req.body);
    }
  } catch (err) { next(err); }
});

app.delete('/enrollments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const enrollmentModel = getModel('Enrollment');
    if (enrollmentModel) {
      const deleted = await enrollmentModel.delete({ where: { EnrollmentID: id } });
      res.status(200).json({ message: 'Enrollment deleted successfully', deleted });
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM Enrollment WHERE EnrollmentID = ?;`, id);
      res.status(200).json({ message: 'Enrollment deleted successfully', EnrollmentID: id });
    }
  } catch (err) { next(err); }
});

// ==========================================
// 5. RESULTS ROUTES
// ==========================================
app.get('/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resultModel = getModel('Results');
    if (resultModel) {
      const data = await resultModel.findMany({ include: { Enrollment: true } });
      res.status(200).json(data);
    } else {
      const data = await prisma.$queryRawUnsafe(`SELECT * FROM Results;`);
      res.status(200).json(data);
    }
  } catch (err) { next(err); }
});

app.post('/results', validateBody(resultSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ResultID, EnrollmentID, Grade, GPA } = req.body;
    const resultModel = getModel('Results');

    if (resultModel) {
      const existing = await resultModel.findUnique({ where: { ResultID } });
      if (existing) {
        res.status(400).json({ error: `Result with ID ${ResultID} already exists.` });
        return;
      }
      const newRecord = await resultModel.create({ data: req.body });
      res.status(201).json(newRecord);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO Results (ResultID, EnrollmentID, Grade, GPA) VALUES (?, ?, ?, ?)`,
        ResultID, EnrollmentID, Grade || null, GPA || null
      );
      res.status(201).json(req.body);
    }
  } catch (err) { next(err); }
});

app.delete('/results/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const resultModel = getModel('Results');
    if (resultModel) {
      const deleted = await resultModel.delete({ where: { ResultID: id } });
      res.status(200).json({ message: 'Result deleted successfully', deleted });
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM Results WHERE ResultID = ?;`, id);
      res.status(200).json({ message: 'Result deleted successfully', ResultID: id });
    }
  } catch (err) { next(err); }
});

// ==========================================
// ERROR HANDLING & SERVER BOOT
// ==========================================
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found.` });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation Failed', details: err.issues.map((e) => e.message) });
    return;
  }
  console.error('SERVER ERROR:', err);
  res.status(500).json({ error: 'Internal Server Error.' });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 System Live at http://localhost:${PORT}`);
  console.log(`==================================================`);
});