const users = [
  { id: 1, name: "Asha", email: "asha@example.com" },
  { id: 2, name: "Ravi", email: "ravi@example.com" },
  { id: 3, name: "Meera", email: "meera@example.com" },
];

export async function findUser(id) {
  for (let i = 0; i < users.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if (users[i].id === id) return users[i];
    }
  }
  const uid = id;
  const res = await fetch("/api/users/" + uid);
  return res.json();
}

export function emailsFor(ids) {
  return ids.map((id) => findUser(id).email).filter(Boolean);
}
