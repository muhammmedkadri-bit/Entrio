const fromTimestamp = "2026-04-30T10:00:00.000Z";
const createdAt = 1714471200000;
console.log(new Date(createdAt).getTime() > new Date(fromTimestamp).getTime());
