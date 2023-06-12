/** @format */

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SK);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

//verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access !" });
    }
    req.decoded = decoded;
    next();
  });
};

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

    //jwt routes
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //verify admin or instructor
    const verifyAdminOrInstructor = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };
      const user = await userCollection.findOne(query);

      if (user?.role !== "admin" && user?.role !== "instructor") {
        console.log("failed");
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      // console.log("pass,role", user?.role);
      next();
    };

    //banner routes
    app.get("/banner", async (req, res) => {
      const banner = await bannerCollection.find().toArray();
      res.send(banner);
    });

    //enroll related route
    app.get("/enrolled", verifyJWT, async (req, res) => {
      const email = req.query.email;

      // console.log(req.decoded);

      if (email) {
        const classes = await enrolledClassCollection
          .find({ email: email })
          .toArray();
        res.send(classes);
      } else {
        const classes = await enrolledClassCollection.find().toArray();
        res.send(classes);
      }
    });

    app.put(
      "/enrolled/:id",
      verifyJWT,
      verifyAdminOrInstructor,
      async (req, res) => {
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
      }
    );

    app.delete(
      "/enrolled/:id",
      verifyJWT,
      verifyAdminOrInstructor,
      async (req, res) => {
        const id = req.params.id;
        const deletedDoc = await enrolledClassCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(deletedDoc);
      }
    );

    //classes route v/n
    app.get("/classes", async (req, res) => {
      const email = req.query.email;
      const limit = req.query.limit;

      try {
        if (limit) {
          const limitInt = parseInt(limit);
          const classes = await classCollection
            .find()
            .sort({ enrolled: -1 })
            .limit(limitInt)
            .toArray();
          res.send(classes);
        } else if (email) {
          const classes = await classCollection
            .find({ instructorEmail: email })
            .toArray();
          res.send(classes);
        } else {
          const classes = await classCollection.find().toArray();
          res.send(classes);
        }
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/classes", verifyJWT, async (req, res) => {
      const classes = req.body;
      const saveClasses = await classCollection.insertOne(classes);

      res.send(saveClasses);
    });

    app.put("/classes/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const status = req.body;

      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: status,
      };
      const updatedClass = await classCollection.updateOne(
        query,
        updateDoc,
        options
      );

      res.send(updatedClass);
    });

    //normal user routes
    app.get("/users", verifyJWT, verifyAdminOrInstructor, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    //for check user role
    app.get("/users/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });

      res.send(user);
    });

    app.put("/users", verifyJWT, verifyAdminOrInstructor, async (req, res) => {
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

    app.patch(
      "/users/:id",
      verifyJWT,
      verifyAdminOrInstructor,
      async (req, res) => {
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
      }
    );

    app.delete(
      "/users/:id",
      verifyJWT,
      verifyAdminOrInstructor,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const deletedUser = await userCollection.deleteOne(query);

        res.send(deletedUser);
      }
    );

    //instructors route v/n
    app.get("/instructors", async (req, res) => {
      const email = req.query.email;
      const role = req.query.role;
      const limit = req.query.limit;

      try {
        if (role) {
          const instructor = await userCollection
            .find({ role: role })
            .toArray();
          res.send(instructor);
        } else if (limit) {
          const limitInt = parseInt(limit);
          const instructor = await userCollection
            .find({ role: "instructor" })
            .limit(limitInt)
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

    app.post(
      "/instructors",
      verifyJWT,
      verifyAdminOrInstructor,
      async (req, res) => {
        const instructor = req.body;
        const savedInstructor = await instructorCollection.insertOne(
          instructor
        );

        res.send(savedInstructor);
      }
    );

    app.patch(
      "/instructor/:email",
      verifyJWT,
      verifyAdminOrInstructor,
      async (req, res) => {
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
      }
    );

    app.delete(
      "/instructor/:email",
      verifyJWT,
      verifyAdminOrInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const deletedInstructor = await instructorCollection.deleteOne(query);

        res.send(deletedInstructor);
      }
    );

    //payment
    app.get("/payment/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const paymentDetail = await paymentCollection
        .find({ email: email })
        .toArray();

      res.send(paymentDetail);
    });

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
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

    app.post("/payment", verifyJWT, async (req, res) => {
      const paymentDetail = req.body;
      const userId = paymentDetail.userId;
      const classId = paymentDetail.classId;

      const updateQuery = { _id: new ObjectId(classId) };

      const updateDoc = {
        $inc: {
          availableSeats: -1,
          enrolled: 1,
        },
      };

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
