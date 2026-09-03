import { Request, Response } from 'express';
import { StudentService } from '../services/student.service';

const studentService = new StudentService();

export class StudentController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const students = await studentService.getAllStudents();
      res.status(200).json(students);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const student = await studentService.getStudentById(Number(req.params.id));
      res.status(200).json(student);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const newStudent = await studentService.createStudent(req.body);
      res.status(201).json(newStudent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      await studentService.deleteStudent(Number(req.params.id));
      res.status(200).json({ message: 'Student deleted successfully by Admin.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}