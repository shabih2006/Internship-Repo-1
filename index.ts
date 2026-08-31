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