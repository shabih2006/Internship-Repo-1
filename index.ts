export {}; // <--- Add this at line 1


console.log("Hello! This is TypeScript!");

interface User {
  id: number;
  name: string;
}

function greetUser(user: User): string {
  return 'Hello, ' + user.name + '!';
}
const sampleUser: User = { id: 1, name: "Shabih" };
console.log(greetUser(sampleUser));
//task5
//task 6

interface Studentinterface {
  id: number;
  name: string;
  age: number;
}
class Student implements Studentinterface {
  constructor(
    public id: number,
    public name: string,
    public age: number
  ) {}
}

// Quick check to test it out!
const testStudent = new Student(1, "Shabih", 20);
const testStudent2 = new Student(2, "Hassan", 20);
console.log(testStudent);
console.log(testStudent2);