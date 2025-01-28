import express from "express";
import session from "express-session";
import bodyParser from "body-parser";
import moment from "moment-timezone";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import os from "os";

// Objeto en memoria para almacenar las sesiones
const sessionsInMemory = {};

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "P4-AFL#Tigrillo-SesionesHTTP-VariablesDeSesion",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 5 * 60 * 1000 },
  })
);

const TIMEZONE = "America/Mexico_City";

const getCurrentTime = () => moment().tz(TIMEZONE).format();

const getClientIp = (req) => {
  const ip =
    req.headers["x-forwarded-for"] || 
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress;
  if (ip === "::1") {
    return "127.0.0.1";
  }
  if (ip.startsWith("::ffff:")) {
    return ip.split(":").pop();
  }
  return ip;
};

const getLocalIp = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
};

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} minuto${minutes !== 1 ? "s" : ""}, ${remainingSeconds} segundo${remainingSeconds !== 1 ? "s" : ""}`;
};

// Bienvenida
app.get("/welcome", (req, res) => {
  return res.status(200).json({
    message: "Bienvenido a la API DevFarias.",
    author: "Al Farias Leyva",
  });
});

// Login Endpoint
app.post("/login", (req, res) => {
  const { email, nickname, macAddress } = req.body;

  if (!email || !nickname || !macAddress) {
    return res.status(400).json({ message: "Falta algún campo." });
  }

  const sessionId = uuidv4();
  const now = getCurrentTime();
  const serverIp = getLocalIp();
  const serverMacAddress = getServerMacAddress();

  // Crear la sesión en memoria
  const newSession = {
    sessionId,
    email,
    nickname,
    macAddress,
    ip: getClientIp(req),
    serverIp,
    serverMacAddress,
    createdAt: now,
    lastAccessedAt: now,
    status: "Activa",
  };

  sessionsInMemory[sessionId] = newSession;

  res.status(200).json({
    message: "Inicio de sesión exitoso.",
    sessionId,
  });
});

// Logout Endpoint
app.post("/logout", (req, res) => {
  const { sessionId } = req.body;

  if (!sessionsInMemory[sessionId]) {
    return res.status(404).json({ message: "No se ha encontrado una sesión activa." });
  }

  sessionsInMemory[sessionId].status = "Finalizada";
  sessionsInMemory[sessionId].lastAccessedAt = getCurrentTime();

  res.status(200).json({
    message: "Logout exitoso.",
    session: sessionsInMemory[sessionId],
  });
});

// Actualización de la sesión
app.put("/update", (req, res) => {
  const { sessionId, email, nickname } = req.body;

  if (!sessionsInMemory[sessionId]) {
    return res.status(404).json({ message: "No existe una sesión activa." });
  }

  if (email) sessionsInMemory[sessionId].email = email;
  if (nickname) sessionsInMemory[sessionId].nickname = nickname;
  sessionsInMemory[sessionId].lastAccessedAt = getCurrentTime();

  res.status(200).json({
    message: "Sesión actualizada correctamente.",
    session: sessionsInMemory[sessionId],
  });
});

// Estado de la sesión
app.get("/status", (req, res) => {
  const { sessionId } = req.query;

  if (!sessionsInMemory[sessionId]) {
    return res.status(404).json({ message: "No hay sesión activa." });
  }

  const session = sessionsInMemory[sessionId];
  const now = moment.tz(TIMEZONE);
  const createdAt = moment(session.createdAt);
  const lastAccessedAt = moment(session.lastAccessedAt);

  const sessionDurationInSeconds = now.diff(createdAt, "seconds");
  const inactivityTimeInSeconds = now.diff(lastAccessedAt, "seconds");

  res.status(200).json({
    message: "Sesión activa.",
    session: {
      ...session,
      sessionDuration: formatTime(sessionDurationInSeconds),
      inactivityTime: formatTime(inactivityTimeInSeconds),
    },
  });
});

// Listar todas las sesiones
app.get("/listAllSessions", (req, res) => {
  const allSessions = Object.values(sessionsInMemory);
  res.status(200).json({ sessions: allSessions });
});

// Función para obtener la MAC Address del servidor
const getServerMacAddress = () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.mac; // Retorna la dirección MAC de la primera interfaz activa
      }
    }
  }
  return "00:00:00:00:00:00"; // Valor predeterminado si no se encuentra una dirección MAC
};

// Destrucción automática de sesiones inactivas
setInterval(() => {
  const now = moment();
  for (const sessionId in sessionsInMemory) {
    const session = sessionsInMemory[sessionId];
    const lastAccessedAt = moment(session.lastAccessedAt);
    const inactivityDuration = now.diff(lastAccessedAt, "seconds");

    if (inactivityDuration > 120 && session.status === "Activa") {
      sessionsInMemory[sessionId].status = "Finalizada";
    }
  }
}, 60 * 1000);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
