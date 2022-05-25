const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kr5fm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("long-drive").collection("tools");
        // get all tools
        app.get("/tool", async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });
        // get single tool
        app.get("/purchase/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const purchase = await toolsCollection.findOne(query);
            res.send(purchase);
        })


    } finally {
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Hello Driver!");
});

app.listen(port, () => {
    console.log(`Long Drive app listening on port ${port}`);
});
