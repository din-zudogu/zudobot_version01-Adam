// Local sandbox DB (root / localsecretpassword from docker-compose)
db = db.getSiblingDB("zudobot");
db.createCollection("_clone_metadata");
db._clone_metadata.insertOne({
  note: "Zudobot sandbox — restore production via scripts/clone/clone-mongodb.mjs --execute",
  createdAt: new Date(),
});
