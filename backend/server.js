require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/projects', require('./routes/projects'));
app.use('/users', require('./routes/users'));
app.use('/tasks', require('./routes/tasks'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
