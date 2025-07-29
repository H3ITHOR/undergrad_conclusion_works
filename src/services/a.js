// Gera um array de strings no formato yyyy-1 e yyyy-2 de 1998-2 até 2024-2
const semesters = [];
for (let year = 1998; year <= 2024; year++) {
  semesters.push(`${year}-1`);
  semesters.push(`${year}-2`);
}
console.log(semesters);