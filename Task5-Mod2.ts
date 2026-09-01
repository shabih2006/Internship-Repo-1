interface student {
    id: number;
    name: string;
}
interface course{
    id: number;
    title: string;
}
class repository<T> {
    private items: T[] = [];

    add(item: T): void {
        this.items.push(item);
    }

    getAll(): T[] {
        return this.items;
    }
}
const studentRepository = new repository<student>();
studentRepository.add({ id: 1, name: "Shabih" });

const courseRepository = new repository<course>();
courseRepository.add({ id: 101, title: "TypeScript 101" });

console.log("Students:", studentRepository.getAll());
console.log("Courses:", courseRepository.getAll());