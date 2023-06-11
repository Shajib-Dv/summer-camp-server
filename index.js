/** @format */

const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SK);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bjkbiuu.mongodb.net/?retryWrites=true&w=majority`;

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
    const enrolledClassCollection = client
      .db("summer-camp")
      .collection("enrolledClasses");
    const classCollection = client.db("summer-camp").collection("classes");
    const paymentCollection = client.db("summer-camp").collection("payments");
    const userCollection = client.db("summer-camp").collection("users");
    const instructorCollection = client
      .db("summer-camp")
      .collection("instructors");

    //banner routes
    app.get("/banner", async (req, res) => {
      const banner = await bannerCollection.find().toArray();
      res.send(banner);
    });

    //enroll related route
    app.get("/enrolled", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        const classes = await enrolledClassCollection.find().toArray();
        res.send(classes);
      }

      if (email) {
        const classes = await enrolledClassCollection
          .find({ email: email })
          .toArray();
        res.send(classes);
      }
    });

    app.put("/enrolled/:id", async (req, res) => {
      const id = req.params.id;
      const classes = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };

      const updateDoc = {
        $set: classes,
      };

      const enrolled = await enrolledClassCollection.updateOne(
        query,
        updateDoc,
        options
      );

      res.send(enrolled);
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

    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body;

      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: status.status,
          feedback: status.feedback,
        },
      };
      const updatedClass = await classCollection.updateOne(
        query,
        updateDoc,
        options
      );

      res.send(updatedClass);
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

      const storedUser = await userCollection.findOne(query);
      if (user.email === storedUser?.email) {
        return res.send({ message: "user already exist !" });
      }

      const saveUser = await userCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(saveUser);
    });

    app.patch("/users/:id", async (req, res) => {
      const role = req.body.role;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const updatedUser = await userCollection.updateOne(query, updateDoc);

      res.send(updatedUser);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const deletedUser = await userCollection.deleteOne(query);

      res.send(deletedUser);
    });

    //instructors route
    app.get("/instructors", async (req, res) => {
      const email = req.query.email;
      const role = req.query.role;

      try {
        if (role) {
          const instructor = await userCollection
            .find({ role: role })
            .toArray();
          res.send(instructor);
        } else if (email) {
          const getInstructor = await instructorCollection.findOne({
            email: email,
          });
          res.send(getInstructor);
        } else {
          const getAllInstructors = await instructorCollection.find().toArray();
          res.send(getAllInstructors);
        }
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/instructors", async (req, res) => {
      const instructor = req.body;
      const savedInstructor = await instructorCollection.insertOne(instructor);

      res.send(savedInstructor);
    });

    app.patch("/instructor/:email", async (req, res) => {
      const role = req.body.role;
      const email = req.params.email;
      const query = { email: email };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const updatedUser = await userCollection.updateOne(query, updateDoc);

      res.send(updatedUser);
    });

    app.delete("/instructor/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const deletedInstructor = await instructorCollection.deleteOne(query);

      res.send(deletedInstructor);
    });

    //payment
    app.get("/payment/:email", async (req, res) => {
      const email = req.params.email;
      const paymentDetail = await paymentCollection
        .find({ email: email })
        .toArray();

      res.send(paymentDetail);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payment", async (req, res) => {
      const paymentDetail = req.body;
      const userId = paymentDetail.userId;
      const classId = paymentDetail.classId;

      const updateQuery = { _id: new ObjectId(classId) };

      const updateDoc = { $inc: { availableSeats: -1 } };

      const insertedResult = await paymentCollection.insertOne(paymentDetail);

      const updateResult = await classCollection.updateOne(
        updateQuery,
        updateDoc
      );

      const deleteResult = await enrolledClassCollection.deleteOne({
        _id: new ObjectId(userId),
      });

      res.send({ insertedResult, updateResult, deleteResult });
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
