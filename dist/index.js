console.log("Hello! This is TypeScript!");
function greetUser(user) {
    return 'Hello, ' + user.name + '!';
}
const sampleUser = { id: 1, name: "Shabih" };
console.log(greetUser(sampleUser));
class Student {
    constructor(id, name, age) {
        this.id = id;
        this.name = name;
        this.age = age;
    }
}
// Quick check to test it out!
const testStudent = new Student(1, "Shabih", 20);
const testStudent2 = new Student(2, "Hassan", 20);
console.log(testStudent);
console.log(testStudent2);
export {};
