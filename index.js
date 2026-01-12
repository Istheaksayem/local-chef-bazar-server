const express = require('express');
const cors = require('cors');
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const e = require('express');
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
        // await client.connect();
        console.log("MongoDB Connected Successfully!");

        const db = client.db('chef_bazar_db');
        const userCollection = db.collection('users')
        const mealsCollection = db.collection('meals');
        const reviewsCollection = db.collection('reviews');
        const favoritesCollection = db.collection('favorites')
        const ordersCollection = db.collection("orders")

        const userRequestsCollection = db.collection("userRequests");
        const paymentCollection = db.collection("payments");

        // ============================
        //        USERS API
        // ============================
        app.post("/users", async (req, res) => {
            const user = req.body;

            const exists = await userCollection.findOne({ email: user.email });


            if (exists) {
                return res.send({ message: "User already exists" });
            }

            user.role = "user";
            user.status = "active"

            const result = await userCollection.insertOne(user);
            res.send(result);
        });



        app.get("/users/role/:email", async (req, res) => {
            const email = req.params.email;

            const user = await userCollection.findOne({ email })
            res.send({ role: user?.role || "user" })
        })

        app.get("/users", async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })

        app.patch("/users/fraud/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: "fraud"
                    }
                }
            )
            res.send(result);
        })
        // app.get("/users/:email", async (req, res) => {
        //     const email = req.params.email;
        //     const user = await userCollection.findOne({ email });
        //     res.send(user);
        // });


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
        app.get('/meals-details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const meal = await mealsCollection.findOne(query);
            // console.log(meal)
            if (!meal) {
                return res.status(404).send({ message: "Meal Not Found" });
            }

            res.send(meal);
        });

        // Add a meal
        app.post('/meals', async (req, res) => {
            const meal = req.body;
            const chef = await userCollection.findOne({ email: meal.chefEmail })
            if (chef?.status === "fraud") {
                return res.status(403).send({
                    message: "Fraud chefs cannot create meals"
                });
            }
            const result = await mealsCollection.insertOne(meal);
            res.send(result);
        });
        app.get("/my-meals", async (req, res) => {
            const email = req.query.email;

            if (!email) {
                return res.status(400).send({ message: "Email required" });
            }

            // filter by chefEmail
            const query = { chefEmail: email };
          

            const result = await mealsCollection.find(query).toArray();
            res.send(result);
           
        });

           
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
            console.log(order)

            const user = await userCollection.findOne({ email: order.userEmail })
            if (user?.status === "fraud") {
                return res.status(403).send({
                    message: "fraud users cannot place orders"
                })
            }
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
        // get orders for specific chef

        app.get("/chef-orders/:chefId", async (req, res) => {
            const id = req.params.chefId
            const orders = await ordersCollection.find({ chefEmail: id }).toArray()

            res.send(orders)
        })

        // app.get("/orders/chef/:chefId", async (req, res) => {
        //     const chefId = req.params.chefId;

        //     const result = await ordersCollection
        //         .find({ chefId })
        //         .sort({ orderTime: -1 })
        //         .toArray();

        //     res.send(result);
        // });


        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            res.send(user);
        });




        app.patch("/orders/:id", async (req, res) => {
            const { id } = req.params.id;
            const { status } = req.body;

            const result = await ordersCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { orderStatus: status } }
            );

            res.send({ success: true });
        });
        // payment
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await ordersCollection.findOne(query);
            res.send(result)
        })





        // payment related 
        app.post("/payment-checkout-session", async (req, res) => {
            const paymentInfo = req.body;
            // console.log(paymentInfo)

            const amount = parseInt(paymentInfo.price) * 100

            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                        price_data: {
                            currency: 'USD',
                            product_data: {
                                name: `please pay for :${paymentInfo.orderName}`
                            },
                            unit_amount: amount,
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                metadata: {
                    orderId: paymentInfo.orderId,
                    orderName: paymentInfo.orderName
                },

                customer_email: paymentInfo.userEmail,
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
            })
            console.log(session)
            res.send({ url: session.url })
        })



        // old
        // app.post('/create-checkout-session', async (req, res) => {
        //     const paymentInfo = req.body;
        //     const amount =parseInt(paymentInfo.price)*100 


        //     const session = await stripe.checkout.sessions.create({
        //         line_items: [
        //             {
        //                 // Provide the exact Price ID (for example, price_1234) of the product you want to sell
        //                 price_data:{
        //                     currency:'USD',
        //                     product_data:{
        //                         name:'Meal Payment'
        //                     },
        //                     unit_amount:amount,
        //                 },
        //                 quantity: 1,
        //             },
        //         ],
        //         mode: 'payment',
        //         success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
        //         cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
        //     })
        //     console.log(session)
        //     res.send({url:session.url})
        // })

        // ===============================
        //   NEW USER ROLE REQUEST API
        // ===============================

        // Send Role Request
        app.patch("/payment-success", async (req, res) => {
            const sessionId = req.body.session_id;

            const session = await stripe.checkout.sessions.retrieve(sessionId)
            console.log("session retrieve", session)
            if (session.payment_status === 'paid') {
                const id = session.metadata.orderId;
                const query = { _id: new ObjectId(id) }
                const update = {
                    $set: {
                        paymentStatus: 'paid',

                    }
                }
                const result = await ordersCollection.updateOne(query, update)
                const payment = {
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    orderId: session.metadata.orderId,
                    transactionId: session.payment_intent,
                    orderName: session.metadata.orderName,
                    paymentStatus: session.payment_status,
                    paidAt: new Date()
                }

                if (session.payment_status === 'paid') {
                    const resultPayment = await paymentCollection.insertOne(payment)
                    res.send({ success: true, modifyOrder: result, paymentInfo: resultPayment })
                }

            }
            res.send({ success: false })
        })

        app.get("/payments/:email", async (req, res) => {
            const email = req.params.email;

            const result = await paymentCollection
                .find({ customerEmail: email })
                .sort({ paidAt: -1 })
                .toArray();

            res.send(result);
        });


        app.post("/request-role", async (req, res) => {
            const { userName, userEmail, requestType } = req.body;

            const requestData = {
                userName,
                userEmail,
                requestType,
                requestStatus: "pending",
                requestTime: new Date()
            };

            const result = await userRequestsCollection.insertOne(requestData);
            res.send({ success: true, result });
        });

        // Get All Requests (Admin)
        app.get("/request-role", async (req, res) => {
            const result = await userRequestsCollection.find().toArray();
            res.send(result);
        });

        // approve chef request
        app.patch("/request-role/approve/:id", async (req, res) => {
            const id = req.params.id;
            const { email } = req.body;

            const request = await userRequestsCollection.findOne({
                _id: new ObjectId(id)
            });
            if (!request) {
                return res.status(404).send({ message: "Request not found" })
            }

            // chef id generate 
            let updateUserData = {};

            if (request.requestType === "chef") {
                const chefId = "chef-" + Math.floor(1000 + Math.random() * 9000)
                updateUserData = {
                    role: "chef",
                    chefId
                }
            }
            if (request.requestType === "admin") {
                updateUserData = {
                    role: "admin"
                }
            }

            // update user role
            await userCollection.updateOne(
                { email },
                { $set: updateUserData }
            );

            // update request status
            await userRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { requestStatus: "approved" } }
            );

            res.send({ success: true, message: "Request approved" });
        });
        app.patch("/request-role/reject/:id", async (req, res) => {
            const id = req.params.id;

            await userRequestsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { requestStatus: "rejected" } }
            );

            res.send({ success: true, message: "Request rejected" });
        });


        //   PLATFORM STATISTICS (ADMIN)
        app.get("/admin/platform-stats", async (req, res) => {
            try {
                const totalUsers = await userCollection.countDocuments();

                const pendingOrders = await ordersCollection.countDocuments({
                    orderStatus: { $ne: "delivered" }
                });

                const deliveredOrders = await ordersCollection.countDocuments({
                    orderStatus: "delivered"
                });

                const payments = await paymentCollection.find().toArray();
                const totalPaymentAmount = payments.reduce(
                    (sum, p) => sum + (p.amount || 0),
                    0
                );

                res.send({
                    totalUsers,
                    pendingOrders,
                    deliveredOrders,
                    totalPaymentAmount
                });
            } catch (err) {
                res.status(500).send({ message: "Failed to load stats" });
            }
        });





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
