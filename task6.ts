interface student{
    id:number;
    name:string;
}
function fetchStudentFromAPI(id:number):Promise<student> {
    return new Promise<student>((resolve, reject) => {
        console.log(`Fetching student with ID: ${id} from API...`);
        setTimeout(() => {
            if (id === 1) {
                resolve({ id: 1, name: "Shabih" });
            } else {
                reject(new Error(`Student with ID ${id} not found`));
            }
        }, 1500);
    });
}
async function runAsyncDemo() {
  console.log("--- Starting Async Test ---");

  try {
    const student = await fetchStudentFromAPI(1);
    console.log("✅ Success! Received Data:", student);
  } catch (error: unknown) {
    console.error("❌ Caught Error:", error instanceof Error ? error.message : String(error));
  }

  try {
    const student = await fetchStudentFromAPI(99);
    console.log("✅ Success! Received Data:", student);
  } catch (error: unknown) {
    console.error("❌ Caught Error:", error instanceof Error ? error.message : String(error));
  }

  console.log("--- Async Test Finished ---");
}

runAsyncDemo();
