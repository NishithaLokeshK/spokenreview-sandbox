const users = [
  { id: 1, name: "Asha", email: "asha@example.com" },
  { id: 2, name: "Ravi", email: "ravi@example.com" },
  { id: 3, name: "Meera", email: "meera@example.com" },
];

export function findUser(id) {
  return users.find((u) => u.id === id);
}

export function emailsFor(ids) {
  return ids.map((id) => findUser(id)?.email).filter(Boolean);
}
