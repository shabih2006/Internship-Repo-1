export {}; // <--- Add this at line 1
type Status = "Active" | "Inactive";


interface StudentModel {
  id: number;
  name: string;
  age: number;
  status: Status;
}

class Student implements StudentModel {
  constructor(
    public id: number,
    public name: string,
    public age: number,
    public status: Status = "Active"
  ) {}
}

const student1 = new Student(1, "Shabih", 20, "Active");
const student2 = new Student(2, "Hassan", 20, "Inactive");

console.log("Student 1:", student1);
console.log("Student 2:", student2);
// Testing an invalid status value
// const invalidStudent = new Student(3, "Saad", 22, "banana");
// console.log("Invalid Student:", invalidStudent);