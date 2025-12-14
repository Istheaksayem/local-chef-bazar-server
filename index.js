const express = require('express');
const cors = require('cors');
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SCERET);


// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ba90y0b.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        console.log("MongoDB Connected Successfully!");

        const db = client.db('chef_bazar_db');
        const mealsCollection = db.collection('meals');
        const reviewsCollection = db.collection('reviews');
        const favoritesCollection = db.collection('favorites')
        const ordersCollection = db.collection("orders")

        const userRequestsCollection = db.collection("userRequests");
        const paymentCollection = db.collection("payments");

        // ============================
        //        MEALS API
        // ============================

        // Get meals with limit
        app.get('/meals', async (req, res) => {
            const limit = parseInt(req.query.limit) || 6;
            const result = await mealsCollection.find().limit(limit).toArray();
            res.send(result);
        });

        // Get all meals
        app.get('/meals/all', async (req, res) => {
            const result = await mealsCollection.find().toArray();
            res.send(result);
        });

        // Get meal details by ID
        app.get('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: id };
            const meal = await mealsCollection.findOne(query);

            if (!meal) {
                return res.status(404).send({ message: "Meal Not Found" });
            }

            res.send(meal);
        });

        // Add a meal
        app.post('/meals', async (req, res) => {
            const meal = req.body;
            const result = await mealsCollection.insertOne(meal);
            res.send(result);
        });
        app.get("/my-meals", async (req, res) => {
            const email = req.query.email

            if (!email) {
                return res.status(400).send({ message: "Email required" })
            }
            const result = await mealsCollection.find.toArray()
            res.send(result)
        })

        // Delete meal
        app.delete('/meals/:id', async (req, res) => {
            const id = req.params.id;

            const result = await mealsCollection.deleteOne({
                _id: new ObjectId(id)
            });

            res.send(result);
        });

        // Update meal
        app.put('/meals/:id', async (req, res) => {
            const id = req.params.id;
            const updatedMeal = req.body;

            const result = await mealsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedMeal }
            );

            res.send(result);
        });



        // ============================
        //       REVIEW API
        // ============================



        // Get limited reviews for homepage
        app.get("/reviews/home", async (req, res) => {
            const limit = parseInt(req.query.limit) || 3;

            const result = await reviewsCollection
                .find()
                .sort({ date: -1 })  // latest first
                .limit(limit)
                .toArray();

            res.send(result);
        });
        // Get reviews for a specific meal
        app.get('/reviews/:foodId', async (req, res) => {
            const foodId = req.params.foodId;
            const query = { foodId: foodId };
            const result = await reviewsCollection.find(query).toArray();
            res.send(result);
        });


        // Add a review
        app.post('/reviews', async (req, res) => {
            const review = req.body;

            review.date = new Date();  // auto date

            const result = await reviewsCollection.insertOne(review);

            res.send(result);
        });

        // Get reviews by user email
        app.get('/reviews/user/:email', async (req, res) => {
            const { email } = req.params;
            const reviews = await reviewsCollection.find({ userEmail: email }).toArray();
            res.send(reviews);
        });

        // Delete review
        app.delete('/reviews/:id', async (req, res) => {
            const { id } = req.params;
            const result = await reviewsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // Update review
        app.patch('/reviews/:id', async (req, res) => {
            const { id } = req.params;
            const updatedData = req.body;
            const result = await reviewsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            );
            res.send(result);
        });





        // ===============================
        //       FAVORITES API
        // ===============================


        // add a favorites
        app.post('/favorites', async (req, res) => {
            const { userEmail, mealId, mealName, chefId, chefName, price } = req.body;

            //  already exists check
            const exists = await favoritesCollection.findOne({ userEmail, mealId });

            if (exists) {
                return res.send({ success: false, message: "Already added to favorites!" });
            }

            const favData = {
                userEmail,
                mealId,
                mealName,
                chefId,
                chefName,
                price,
                addedTime: new Date()
            }
            const result = await favoritesCollection.insertOne(favData)
            res.send({ success: true, message: "Added to favorites!", result });
        })
        app.get('/favorites/:email', async (req, res) => {
            const email = req.params.email;
            const result = await favoritesCollection.find({ userEmail: email }).toArray();
            res.send(result)
        })
        // delete favorite
        app.delete("/favorites/:id", async (req, res) => {
            const id = req.params.id;

            const result = await favoritesCollection.deleteOne({
                _id: new ObjectId(id)
            })
            res.send(result)
        })

        // ============================
        //     ORDERS API
        // =============================

        // add order
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order)
            res.send(result)
        })

        // get order of user
        app.get("/orders/:email", async (req, res) => {
            const email = req.params.email;
            const result = await ordersCollection.find({ userEmail: email }).toArray();
            res.send(result);
        });
        // Get all orders for a specific user
        app.get("/orders/user/:email", async (req, res) => {
            const email = req.params.email;

            const result = await ordersCollection
                .find({ userEmail: email })
                .sort({ orderTime: -1 })
                .toArray();

            res.send(result);
        });

        // ===============================
        //   NEW USER ROLE REQUEST API
        // ===============================

        // Send Role Request
        app.post("/request-role", async (req, res) => {
            const { userName, userEmail, requestType } = req.body;

            if (!userName || !userEmail || !requestType) {
                return res.status(400).send({ message: "Invalid Request Data" });
            }

            const requestData = {
                userName,
                userEmail,
                requestType,
                requestStatus: "pending",
                requestTime: new Date()
            };

            const result = await userRequestsCollection.insertOne(requestData);

            res.send({
                success: true,
                message: "Role request sent successfully!",
                result
            });
        });

        // Get All Requests (Admin)
        app.get("/request-role", async (req, res) => {
            const result = await userRequestsCollection.find().toArray();
            res.send(result);
        });

        // app.post("/create-checkout-session", async (req, res) => {
        //     const { mealName, price, quantity, _id } = req.body;

        //     const session = await stripe.checkout.sessions.create({
        //         payment_method_types: ["card"],
        //         mode: "payment",

        //         line_items: [
        //             {
        //                 price_data: {
        //                     currency: "usd",
        //                     product_data: {
        //                         name: mealName,
        //                     },
        //                     unit_amount: price * 100,
        //                 },
        //                 quantity: quantity,
        //             },
        //         ],

        //         success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
        //         cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
        //     });

        //     res.send({ url: session.url });
        // });

        // app.patch("/orders/payment/:id", async (req, res) => {
        //     const id = req.params.id;

        //     const result = await ordersCollection.updateOne(
        //         { _id: new ObjectId(id) },
        //         { $set: { paymentStatus: "paid" } }
        //     );

        //     res.send(result);
        // });



    } catch (error) {
        console.log(error);
    }
}

run().catch(console.dir);

// root route
app.get('/', (req, res) => {
    res.send('Chef Bazar Server Running...');
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
