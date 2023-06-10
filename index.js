/** @format */

const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bjkbiuu.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const bannerCollection = client.db("summer-camp").collection("banners");
    const classCollection = client.db("summer-camp").collection("classes");
    const userCollection = client.db("summer-camp").collection("users");
    const instructorCollection = client
      .db("summer-camp")
      .collection("instructors");

    //banner routes
    app.get("/banner", async (req, res) => {
      const banner = await bannerCollection.find().toArray();
      res.send(banner);
    });

    //classes route
    app.get("/classes", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        const classes = await classCollection.find().toArray();
        res.send(classes);
      }

      if (email) {
        const classes = await classCollection
          .find({ instructorEmail: email })
          .toArray();
        res.send(classes);
      }
    });

    app.post("/classes", async (req, res) => {
      const classes = req.body;
      const saveClasses = await classCollection.insertOne(classes);

      res.send(saveClasses);
    });

    //normal user routes
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });

      res.send(user);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const saveUser = await userCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(saveUser);
    });

    //instructors route
    app.get("/instructors", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        const getAllInstructor = await instructorCollection.find().toArray();
        res.send(getAllInstructor);
      }
      if (email) {
        const getInstructor = await instructorCollection.findOne({
          email: email,
        });

        res.send(getInstructor);
      }
    });

    app.post("/instructors", async (req, res) => {
      const instructor = req.body;
      const savedInstructor = await instructorCollection.insertOne(instructor);

      res.send(savedInstructor);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Summer-Camp is running...");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
