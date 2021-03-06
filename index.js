const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kr5fm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});
// ========Token========
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized Access" });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
    });
}
// ========Token========

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("long-drive").collection("tools");
        const usersCollection = client.db("long-drive").collection("users");
        const ordersCollection = client.db("long-drive").collection("orders");
        const paymentsCollection = client.db("long-drive").collection("payments");
        const reviewsCollection = client.db("long-drive").collection("reviews");

        // ==Veryfy Token==
        app.put("/user/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body.user.user;
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, option);
            const token = jwt.sign(
                { email: email },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: "1d" }
            );
            res.send({ result, token });
        });
        // ==Verify Token==



        // ===Admin verify===
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({
                email: requester,
            });
            if (requesterAccount.role === "admin") {
                next();
            } else {
                return res.status(403).send({ message: "Forbidden Access" });
            }
        };
        // ===Admin verify===


        //get Admin
        app.get("/admin/:email", async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === "admin";
            res.send({ admin: isAdmin });
        });



        // ===========Make Admin============
        app.put("/user/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: "admin" },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            return res.send(result);
        });

        // get all users
        app.get("/user", verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        });
        // Update  user profile
        app.put("/profile/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const profile = req.body;
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: profile,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, option);
            res.send(result);
        });
        // get individual user profile
        app.get("/profile/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await usersCollection.findOne(filter);
            res.send(result);
        });

        // ===Payment Intent===
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const orderPay = req.body;
            const price = parseInt(orderPay.price) * parseInt(orderPay.orderQuantity);
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({ clientSecret: paymentIntent.client_secret });
        });
        // ===Payment Intent===

        // get all tools
        app.get("/tool", async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });
        // ========add new tool in db by admin============
        app.post("/tool", verifyJWT, verifyAdmin, async (req, res) => {
            const tool = req.body;
            const tools = await toolsCollection.insertOne(tool);
            return res.send(tools);
        });
        // Delete tools from db by admin
        app.delete("/tool/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(filter);
            res.send(result);
        });
        // add review
        app.post("/review", verifyJWT, async (req, res) => {
            const review = req.body;
            const reviews = await reviewsCollection.insertOne(review);
            return res.send(reviews);
        });
        // get review
        app.get("/review", async (req, res) => {
            const query = {};
            const cursor = reviewsCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        // get single tool for purchase
        app.get("/purchase/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const purchase = await toolsCollection.findOne(query);
            res.send(purchase);
        });
        //Post Order in db
        app.post("/order", verifyJWT, async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order);
            return res.send(result);
        });
        // get order from db
        app.get("/order", verifyJWT, async (req, res) => {

            const userEmail = req.query.userEmail;
            const decodedEmail = req.decoded.email;

            if (userEmail === decodedEmail) {
                const query = { userEmail: userEmail };
                const orders = await ordersCollection.find(query).toArray();
                return res.send(orders);
            } else {
                return res.status(403).send({ message: "Forbidden Access" });
            }

        });
        // get all orders from db to manage orders
        app.get("/manage", verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const orders = await ordersCollection.find(query).toArray();
            res.send(orders);
        });
        // delete orders from manage orders
        app.delete("/manage/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });
        // Update orders from manage orders
        app.put("/manage/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    status: "shipped"
                },
            };
            const result = await ordersCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            res.send(result);
        });
        // get single ordered tool
        app.get("/order/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const orders = await ordersCollection.findOne(filter);
            res.send(orders);
        });
        // Delete order from db
        app.delete("/order/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(filter);
            res.send(result);
        });

        // set payment status
        app.patch("/order/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                    status: "pending"
                },
            };
            const result = await paymentsCollection.insertOne(payment);
            const updatedOrder = await ordersCollection.updateOne(
                filter,
                updateDoc
            );
            res.send(updateDoc);
        });


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
