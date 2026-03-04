import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("thidua.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL, -- 'admin' or 'leader'
    group_id INTEGER,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    group_id INTEGER,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    points INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    rule_id INTEGER,
    points_change INTEGER,
    note TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id),
    FOREIGN KEY (rule_id) REFERENCES rules(id)
  );
`);

// Seed initial data if empty
const groupCount = db.prepare("SELECT COUNT(*) as count FROM groups").get() as { count: number };
if (groupCount.count === 0) {
  const insertGroup = db.prepare("INSERT INTO groups (id, name) VALUES (?, ?)");
  insertGroup.run(1, "Tổ 1");
  insertGroup.run(2, "Tổ 2");
  insertGroup.run(3, "Tổ 3");
  insertGroup.run(4, "Tổ 4");

  const insertUser = db.prepare("INSERT INTO users (username, password, role, group_id) VALUES (?, ?, ?, ?)");
  insertUser.run("admin", "2026", "admin", null);
  insertUser.run("to1", "2026", "leader", 1);
  insertUser.run("to2", "2026", "leader", 2);
  insertUser.run("to3", "2026", "leader", 3);
  insertUser.run("to4", "2026", "leader", 4);

  const insertStudent = db.prepare("INSERT INTO students (name, group_id) VALUES (?, ?)");
  // Tổ 1
  insertStudent.run("Puih Quân", 1);
  insertStudent.run("Rơ Mah Tuyên", 1);
  insertStudent.run("Phạm Thị Diễm Quỳnh", 1);
  insertStudent.run("Hoàng Thị Minh Châu", 1);
  insertStudent.run("Nguyễn Huy Tài", 1);
  insertStudent.run("Nguyễn Thị Linh", 1);
  insertStudent.run("Rơ Lan Tâm", 1);
  insertStudent.run("Nguyễn Hoàng Anh", 1);
  insertStudent.run("Rơ Lan Hân", 1);
  insertStudent.run("Siu Kuân", 1);
  insertStudent.run("Phạm Đình Chính", 1);
  insertStudent.run("Hoàng Gia Long", 1);

  // Tổ 2
  insertStudent.run("Mai Thị Nương", 2);
  insertStudent.run("Trần Thị Phương Ly", 2);
  insertStudent.run("Trương Ngọc Tuyết", 2);
  insertStudent.run("Vũ Thị Hải Yến", 2);
  insertStudent.run("Phạm Quỳnh Anh", 2);
  insertStudent.run("Nguyễn Như Đạt", 2);
  insertStudent.run("Nguyễn Tú Tài", 2);
  insertStudent.run("Lê Trung Nguyên", 2);
  insertStudent.run("Phan Văn Tiến Dũng", 2);
  insertStudent.run("Puil Gun", 2);

  // Tổ 3
  insertStudent.run("Nguyễn Thị Thuý Nga", 3);
  insertStudent.run("Đậu Quỳnh Nga", 3);
  insertStudent.run("Trần Quốc An", 3);
  insertStudent.run("Trần Tú Tài", 3);
  insertStudent.run("Nguyễn Hương Giang", 3);
  insertStudent.run("Cầm Linh Nhi", 3);
  insertStudent.run("Phạm Hoàng Anh Tú", 3);
  insertStudent.run("Ngô Thành Ngàn", 3);
  insertStudent.run("Rơ Lan Phương", 3);
  insertStudent.run("Phạm Thị Liên", 3);
  insertStudent.run("Dương Thị Yên Nhi", 3);

  // Tổ 4
  insertStudent.run("Nguyễn Thị Thùy Thương", 4);
  insertStudent.run("Đỗ Khánh Việt Anh", 4);
  insertStudent.run("Trần Đình Quang", 4);
  insertStudent.run("Lê Thị Phương Thảo", 4);
  insertStudent.run("Dương Thị Thanh Tâm", 4);
  insertStudent.run("Lê Thị Thảo Phương", 4);
  insertStudent.run("Trần Hải Lý", 4);
  insertStudent.run("Đặng Thị Diễm Quỳnh", 4);
  insertStudent.run("Rơ Lan Trúc", 4);
  insertStudent.run("Rơ Ma BLí", 4);

  const insertRule = db.prepare("INSERT INTO rules (description, points) VALUES (?, ?)");
  insertRule.run("Đi học trễ / vào lớp sau GV / nói chuyện", -5);
  insertRule.run("Vắng học không phép", -20);
  insertRule.run("Trốn học (cúp tiết)", -10);
  insertRule.run("Vắng có phép", -3);
  insertRule.run("KT miệng 0–2 điểm", -10);
  insertRule.run("KT miệng 3–4 điểm", -5);
  insertRule.run("Quay cóp khi kiểm tra", -10);
  insertRule.run("Ban cán sự lớp / Tham gia phong trào", 30);
  insertRule.run("Sử dụng điện thoại trong giờ học", -10);
  insertRule.run("Không áo đồng phục", -10);
  insertRule.run("Mất trật tự / ghi sổ đầu bài", -10);
  insertRule.run("Không lao động / trực nhật / HĐ tập thể", -20);
  insertRule.run("Vi phạm ATGT", -10);
  insertRule.run("Xả rác / mang đồ ăn nước uống / nói chuyện riêng", -5);
  insertRule.run("Viết vẽ bậy / Ngồi lên bàn / xô đổ bàn ghế", -5);
  insertRule.run("Làm lớp bị giờ T9, K8, K7, TB", -5);
  insertRule.run("Nói tục, chửi thề", -10);
  insertRule.run("Phát biểu, xây dựng bài", 2);
  insertRule.run("Đạt điểm 8, 9, 10", 5);
  insertRule.run("Làm việc tốt (Nhặt đồ trả đoàn trường)", 10);
  insertRule.run("Son môi / nhuộm tóc / nam đeo khuyên tai", -5);
  insertRule.run("Nói chuyện riêng / làm việc riêng", -5);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    
    if (user) {
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          group_id: user.group_id
        }
      });
    } else {
      res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
    }
  });

  app.post("/api/students", (req, res) => {
    const { name, group_id } = req.body;
    try {
      const result = db.prepare("INSERT INTO students (name, group_id) VALUES (?, ?)").run(name, group_id);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ success: false, message: "Lỗi khi thêm học sinh" });
    }
  });

  app.delete("/api/students/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM logs WHERE student_id = ?").run(id);
      db.prepare("DELETE FROM students WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Lỗi khi xóa học sinh" });
    }
  });

  app.get("/api/students/:id/logs", (req, res) => {
    const { id } = req.params;
    const logs = db.prepare(`
      SELECT 
        l.id,
        l.points_change,
        l.note,
        l.timestamp,
        r.description as rule_description
      FROM logs l
      LEFT JOIN rules r ON l.rule_id = r.id
      WHERE l.student_id = ?
      ORDER BY l.timestamp DESC
    `).all(id);
    res.json(logs);
  });

  app.post("/api/logs", (req, res) => {
    const { student_id, rule_id, points_change, note, user_id } = req.body;
    
    // Check permissions
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id) as any;
    const student = db.prepare("SELECT * FROM students WHERE id = ?").get(student_id) as any;

    if (!user || !student) {
      return res.status(404).json({ success: false, message: "Không tìm thấy thông tin" });
    }

    if (user.role === 'leader' && user.group_id !== student.group_id) {
      return res.status(403).json({ success: false, message: "Bạn chỉ có quyền ghi nhận cho thành viên tổ mình" });
    }

    try {
      db.prepare("INSERT INTO logs (student_id, rule_id, points_change, note) VALUES (?, ?, ?, ?)")
        .run(student_id, rule_id, points_change, note);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Lỗi khi ghi nhận vi phạm" });
    }
  });

  app.get("/api/rules", (req, res) => {
    const rules = db.prepare("SELECT * FROM rules").all();
    res.json(rules);
  });

  app.get("/api/summary", (req, res) => {
    const groups = db.prepare(`
      SELECT 
        g.id, 
        g.name, 
        COUNT(s.id) as student_count,
        COALESCE(SUM(l.points_change), 0) + (COUNT(s.id) * 200) as total_points
      FROM groups g
      LEFT JOIN students s ON g.id = s.group_id
      LEFT JOIN logs l ON s.id = l.student_id
      GROUP BY g.id
    `).all() as any[];

    const rankings = groups.map(g => ({
      ...g,
      avg_points: g.student_count > 0 ? g.total_points / g.student_count : 200
    })).sort((a, b) => b.avg_points - a.avg_points);

    res.json(rankings);
  });

  app.get("/api/students", (req, res) => {
    const students = db.prepare(`
      SELECT 
        s.id, 
        s.name, 
        g.name as group_name,
        COALESCE(SUM(l.points_change), 0) + 200 as current_points
      FROM students s
      JOIN groups g ON s.group_id = g.id
      LEFT JOIN logs l ON s.id = l.student_id
      GROUP BY s.id
    `).all();
    res.json(students);
  });

  app.post("/api/ai-process", async (req, res) => {
    const { message, user_id, customApiKey } = req.body;
    
    // Check user permissions
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id) as any;
    if (!user) return res.status(401).json({ success: false, message: "Chưa đăng nhập" });

    const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        message: "Hệ thống chưa có API Key. Vui lòng điền API Key trong phần cấu hình hoặc Secrets." 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Get rules and students for context
    const rules = db.prepare("SELECT * FROM rules").all() as any[];
    const students = db.prepare("SELECT s.id, s.name, g.name as group_name, s.group_id FROM students s JOIN groups g ON s.group_id = g.id").all() as any[];

    const systemInstruction = `
      Bạn là Chuyên viên Quản lý Thi đua 12A6. 
      Nhiệm vụ: Phân tích tin nhắn người dùng để xác định học sinh và lỗi vi phạm/đóng góp.
      
      Danh sách học sinh: ${JSON.stringify(students)}
      Danh sách quy định: ${JSON.stringify(rules)}

      QUY TẮC NHẬN DIỆN TÊN:
      1. Nếu người dùng chỉ ghi tên (vd: "Quân"), hãy tìm trong danh sách xem có bao nhiêu học sinh có tên đó (tên thường là từ cuối cùng trong họ tên).
      2. Nếu chỉ có DUY NHẤT một học sinh khớp, hãy chọn học sinh đó.
      3. Nếu có NHIỀU HƠN một học sinh khớp (vd: "Quỳnh" khớp với "Đặng Thị Diễm Quỳnh" và "Phạm Thị Diễm Quỳnh"), hãy đặt "found" là false và yêu cầu người dùng làm rõ trong "explanation" (vd: "Có 2 bạn tên Quỳnh: Đặng Thị Diễm Quỳnh và Phạm Thị Diễm Quỳnh. Bạn đang nhắc đến ai?").
      4. Nếu người dùng cung cấp họ tên đầy đủ hoặc họ + tên đủ để phân biệt, hãy chọn học sinh đó.
      5. Nếu không tìm thấy học sinh nào, đặt "found" là false.

      QUY TẮC PHÂN QUYỀN:
      Người dùng hiện tại là: ${user.role === 'admin' ? 'Quản trị viên (toàn quyền)' : `Tổ trưởng tổ ${user.group_id} (chỉ được nhập cho tổ ${user.group_id})`}.
      Nếu người dùng là Tổ trưởng và cố gắng nhập cho học sinh tổ khác, hãy đặt "found" là false và giải thích trong "explanation" rằng họ không có quyền.

      Hãy trả về kết quả dưới dạng JSON:
      {
        "found": boolean,
        "student_id": number | null,
        "rule_id": number | null,
        "points_change": number,
        "explanation": string
      }
      Nếu không tìm thấy học sinh hoặc quy định phù hợp, hãy đặt found = false.
    `;

    try {
      console.log("Processing message with AI:", message);
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: message,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              found: { type: Type.BOOLEAN },
              student_id: { type: Type.INTEGER },
              rule_id: { type: Type.INTEGER },
              points_change: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["found", "explanation"]
          }
        }
      });

      console.log("AI Response:", response.text);
      const result = JSON.parse(response.text || "{}");

      if (result.found && result.student_id && result.rule_id) {
        db.prepare("INSERT INTO logs (student_id, rule_id, points_change, note) VALUES (?, ?, ?, ?)")
          .run(result.student_id, result.rule_id, result.points_change, result.explanation);
        
        const student = students.find(s => s.id === result.student_id);
        const currentPoints = db.prepare("SELECT COALESCE(SUM(points_change), 0) + 200 as total FROM logs WHERE student_id = ?").get(result.student_id) as { total: number };
        
        res.json({
          success: true,
          message: `Đã ghi nhận: ${student.name} (${student.group_name}) ${result.explanation}. Tổng điểm hiện tại: ${currentPoints.total} điểm.`
        });
      } else {
        res.json({ success: false, message: result.explanation || "Tôi không hiểu yêu cầu của bạn hoặc không tìm thấy học sinh/lỗi tương ứng." });
      }
    } catch (error: any) {
      console.error("AI Process Error:", error);
      let errorMessage = "Lỗi khi xử lý AI";
      
      if (error.message?.includes("API key not valid") || error.status === "INVALID_ARGUMENT") {
        errorMessage = "Khóa API (API Key) không hợp lệ. Vui lòng kiểm tra lại biến GEMINI_API_KEY trong phần Secrets của Google AI Studio (đảm bảo không có khoảng trắng thừa và khóa còn hoạt động).";
      } else {
        errorMessage += ": " + (error.message || "Lỗi không xác định");
      }

      res.status(500).json({ 
        success: false, 
        message: errorMessage
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
