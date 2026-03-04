import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  LogOut, 
  ShieldCheck, 
  TrendingDown, 
  TrendingUp,
  Award,
  Send,
  Loader2,
  History,
  PlusCircle,
  X,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type Student = {
  id: number;
  name: string;
  group_name: string;
  current_points: number;
};

type Log = {
  id: number;
  points_change: number;
  note: string;
  timestamp: string;
  rule_description: string;
};

type Rule = {
  id: number;
  description: string;
  points: number;
};

type GroupSummary = {
  id: number;
  name: string;
  student_count: number;
  total_points: number;
  avg_points: number;
};

type User = {
  id: number;
  username: string;
  role: 'admin' | 'leader';
  group_id: number | null;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'chat' | 'manage'>('dashboard');
  
  const [summary, setSummary] = useState<GroupSummary[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', text: string }[]>(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showApiConfig, setShowApiConfig] = useState(false);

  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Filters
  const [groupFilter, setGroupFilter] = useState<number | 'all'>('all');

  // Logs & Rules
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentLogs, setStudentLogs] = useState<Log[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  
  // Manual Log Form
  const [manualRuleId, setManualRuleId] = useState<number>(0);
  const [manualNote, setManualNote] = useState('');
  const [manualQuantity, setManualQuantity] = useState<number>(1);

  // New Student Form
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGroupId, setNewStudentGroupId] = useState<number>(1);

  useEffect(() => {
    if (user) {
      fetchData();
      fetchRules();
    }
  }, [user]);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/rules');
      setRules(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudentLogs = async (studentId: number) => {
    try {
      const res = await fetch(`/api/students/${studentId}/logs`);
      setStudentLogs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewLogs = (student: Student) => {
    setSelectedStudent(student);
    fetchStudentLogs(student.id);
    setShowLogModal(true);
  };

  const handleManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !manualRuleId) return;
    
    const rule = rules.find(r => r.id === manualRuleId);
    if (!rule) return;

    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent.id,
          rule_id: rule.id,
          points_change: rule.points,
          note: manualNote || rule.description,
          user_id: user?.id,
          quantity: manualQuantity
        })
      });
      if (res.ok) {
        setManualNote('');
        setManualRuleId(0);
        setManualQuantity(1);
        fetchStudentLogs(selectedStudent.id);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bản ghi này không?")) return;
    if (!selectedStudent) return;

    try {
      const res = await fetch(`/api/logs/${logId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      });
      if (res.ok) {
        fetchStudentLogs(selectedStudent.id);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.message || "Lỗi khi xóa bản ghi");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      const [sumRes, stdRes] = await Promise.all([
        fetch('/api/summary'),
        fetch('/api/students')
      ]);
      
      if (!sumRes.ok || !stdRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const sumData = await sumRes.json();
      const stdData = await stdRes.json();
      
      if (Array.isArray(sumData)) setSummary(sumData);
      if (Array.isArray(stdData)) setStudents(stdData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ');
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStudentName, group_id: newStudentGroupId })
      });
      if (res.ok) {
        setNewStudentName('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa học sinh này? Tất cả lịch sử điểm cũng sẽ bị xóa.')) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isProcessing) return;

    // Check if API key is provided
    if (!apiKey) {
      if (confirm("Bạn chưa điền API Key. Bạn có muốn điền ngay không?")) {
        setShowApiConfig(true);
      }
      return;
    }

    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/ai-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg, 
          user_id: user?.id,
          customApiKey: apiKey 
        })
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', text: data.message }]);
      fetchData(); // Refresh data after AI update
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: 'Lỗi khi xử lý yêu cầu.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-serif">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-black/5"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#5A5A40] text-white rounded-full mb-4">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-3xl font-bold text-[#1a1a1a]">Quản lý Thi đua 12A6</h1>
            <p className="text-[#5A5A40]/60 italic mt-2">Vui lòng đăng nhập để tiếp tục</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2 uppercase tracking-wider">Tài khoản</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all font-sans"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2 uppercase tracking-wider">Mật khẩu</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all font-sans"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-500 text-sm italic">{error}</p>}
            <button 
              type="submit"
              className="w-full bg-[#5A5A40] text-white py-4 rounded-full font-medium hover:bg-[#4A4A30] transition-colors shadow-lg shadow-[#5A5A40]/20"
            >
              Đăng nhập hệ thống
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex font-serif">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-black/5 flex flex-col">
        <div className="p-6 border-bottom border-black/5">
          <h2 className="text-xl font-bold text-[#1a1a1a]">Lớp 12A6</h2>
          <p className="text-xs text-[#5A5A40]/60 uppercase tracking-widest mt-1">
            {user.role === 'admin' ? 'Quản trị viên' : `Tổ trưởng ${user.group_id}`}
          </p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#1a1a1a]/60 hover:bg-black/5'}`}
          >
            <LayoutDashboard size={20} />
            <span>Tổng quan</span>
          </button>
          <button 
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'students' ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#1a1a1a]/60 hover:bg-black/5'}`}
          >
            <Users size={20} />
            <span>Học sinh</span>
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#1a1a1a]/60 hover:bg-black/5'}`}
          >
            <MessageSquare size={20} />
            <span>AI Assistant</span>
          </button>
          {user.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('manage')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'manage' ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#1a1a1a]/60 hover:bg-black/5'}`}
            >
              <ShieldCheck size={20} />
              <span>Quản lý thành viên</span>
            </button>
          )}
          <button 
            onClick={() => setShowApiConfig(true)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${showApiConfig ? 'bg-[#5A5A40] text-white shadow-md' : 'text-[#1a1a1a]/60 hover:bg-black/5'}`}
          >
            <Key size={20} />
            <span>Cấu hình API Key</span>
          </button>
        </nav>

        <div className="p-4 border-t border-black/5">
          <button 
            onClick={() => setUser(null)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-bold text-[#1a1a1a]">Bảng xếp hạng Tổ</h1>
                  <p className="text-[#5A5A40]/60 italic">Cập nhật thời gian thực dựa trên điểm trung bình</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl border border-black/5 shadow-sm">
                  <span className="text-xs uppercase tracking-widest text-[#5A5A40]/60 block">Điểm gốc</span>
                  <span className="text-2xl font-bold text-[#1a1a1a]">200 pts</span>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {summary.map((group, index) => (
                  <motion.div 
                    key={group.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm relative overflow-hidden"
                  >
                    {index === 0 && (
                      <div className="absolute top-0 right-0 bg-yellow-400 text-white p-2 rounded-bl-2xl">
                        <Award size={20} />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-[#1a1a1a] mb-1">{group.name}</h3>
                    <p className="text-xs text-[#5A5A40]/60 uppercase tracking-widest mb-4">{group.student_count} học sinh</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-[#1a1a1a]">{group.avg_points.toFixed(1)}</span>
                      <span className="text-sm text-[#5A5A40]/60">trung bình</span>
                    </div>
                    <div className="mt-4 h-2 bg-black/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#5A5A40]" 
                        style={{ width: `${Math.min(100, (group.avg_points / 250) * 100)}%` }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-black/5 flex justify-between items-center">
                  <h3 className="font-bold text-[#1a1a1a]">Chi tiết điểm số</h3>
                  <button onClick={fetchData} className="text-xs uppercase tracking-widest text-[#5A5A40] hover:underline">Làm mới</button>
                </div>
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="bg-black/5 text-[10px] uppercase tracking-widest text-[#5A5A40]/60">
                      <th className="px-6 py-4">Hạng</th>
                      <th className="px-6 py-4">Tổ</th>
                      <th className="px-6 py-4">Tổng điểm</th>
                      <th className="px-6 py-4">Điểm TB</th>
                      <th className="px-6 py-4">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {summary.map((group, idx) => (
                      <tr key={group.id} className="hover:bg-black/[0.02] transition-colors">
                        <td className="px-6 py-4 font-serif font-bold italic">{idx + 1}</td>
                        <td className="px-6 py-4 font-medium">{group.name}</td>
                        <td className="px-6 py-4">{group.total_points}</td>
                        <td className="px-6 py-4 font-bold">{group.avg_points.toFixed(1)}</td>
                        <td className="px-6 py-4">
                          {group.avg_points >= 200 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
                              <TrendingUp size={14} /> Tốt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-bold">
                              <TrendingDown size={14} /> Cần cố gắng
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'students' && (
            <motion.div 
              key="students"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-bold text-[#1a1a1a]">Danh sách học sinh</h1>
                  <p className="text-[#5A5A40]/60 italic">Theo dõi điểm số cá nhân</p>
                </div>
                
                <div className="flex bg-white p-1 rounded-2xl border border-black/5 shadow-sm">
                  <button 
                    onClick={() => setGroupFilter('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${groupFilter === 'all' ? 'bg-[#5A5A40] text-white' : 'text-[#5A5A40]/60 hover:bg-black/5'}`}
                  >
                    Tất cả
                  </button>
                  {[1, 2, 3, 4].map(id => (
                    <button 
                      key={id}
                      onClick={() => setGroupFilter(id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${groupFilter === id ? 'bg-[#5A5A40] text-white' : 'text-[#5A5A40]/60 hover:bg-black/5'}`}
                    >
                      Tổ {id}
                    </button>
                  ))}
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students
                  .filter(s => groupFilter === 'all' || s.group_name.includes(groupFilter.toString()))
                  .map((student) => (
                  <div key={student.id} className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm flex justify-between items-center group">
                    <div>
                      <h4 className="font-bold text-[#1a1a1a]">{student.name}</h4>
                      <p className="text-xs text-[#5A5A40]/60 uppercase tracking-widest">{student.group_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handleViewLogs(student)}
                        className="p-2 text-[#5A5A40]/40 hover:text-[#5A5A40] hover:bg-black/5 rounded-lg transition-all"
                        title="Xem lịch sử vi phạm"
                      >
                        <History size={18} />
                      </button>
                      <div className={`text-xl font-bold ${student.current_points >= 200 ? 'text-[#5A5A40]' : 'text-amber-700'}`}>
                        {student.current_points}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Log Modal */}
              <AnimatePresence>
                {showLogModal && selectedStudent && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                      <div className="p-6 border-b border-black/5 flex justify-between items-center bg-[#5A5A40] text-white">
                        <div>
                          <h3 className="text-xl font-bold">{selectedStudent.name}</h3>
                          <p className="text-xs opacity-70 uppercase tracking-widest">{selectedStudent.group_name} • Hiện tại: {selectedStudent.current_points} pts</p>
                        </div>
                        <button onClick={() => setShowLogModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                          <X size={24} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* Manual Entry Form */}
                        {((user?.role === 'admin') || (user?.role === 'leader' && user?.group_id === (students.find(s => s.id === selectedStudent.id)?.group_name.includes(user.group_id?.toString() || '') ? user.group_id : -1))) && (
                          <div className="bg-black/5 p-4 rounded-2xl">
                            <h4 className="text-xs uppercase tracking-widest font-bold text-[#5A5A40] mb-3 flex items-center gap-2">
                              <PlusCircle size={14} /> Ghi nhận vi phạm/đóng góp thủ công
                            </h4>
                            <form onSubmit={handleManualLog} className="flex flex-col gap-3">
                              <select 
                                value={manualRuleId}
                                onChange={(e) => setManualRuleId(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-sans"
                              >
                                <option value={0}>Chọn quy định...</option>
                                {rules.map(r => (
                                  <option key={r.id} value={r.id}>{r.description} ({r.points > 0 ? '+' : ''}{r.points}đ)</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  value={manualNote}
                                  onChange={(e) => setManualNote(e.target.value)}
                                  placeholder="Ghi chú thêm (không bắt buộc)"
                                  className="flex-1 px-4 py-2 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-sans"
                                />
                                <div className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-3">
                                  <span className="text-[10px] uppercase font-bold text-[#5A5A40]/40">Số lần:</span>
                                  <input 
                                    type="number" 
                                    min="1"
                                    max="10"
                                    value={manualQuantity}
                                    onChange={(e) => setManualQuantity(parseInt(e.target.value) || 1)}
                                    className="w-12 py-2 text-sm focus:outline-none font-sans font-bold text-[#5A5A40]"
                                  />
                                </div>
                                <button 
                                  type="submit"
                                  disabled={!manualRuleId}
                                  className="bg-[#5A5A40] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
                                >
                                  Lưu
                                </button>
                              </div>
                            </form>
                          </div>
                        )}

                        {/* Logs List */}
                        <div className="space-y-3">
                          <h4 className="text-xs uppercase tracking-widest font-bold text-[#5A5A40]/60">Lịch sử điểm số</h4>
                          {studentLogs.length === 0 ? (
                            <p className="text-center py-8 text-[#5A5A40]/40 italic">Chưa có vi phạm hoặc đóng góp nào được ghi nhận.</p>
                          ) : (
                            <div className="space-y-2">
                              {studentLogs.map(log => (
                                <div key={log.id} className="flex items-center justify-between p-3 rounded-xl border border-black/5 bg-white shadow-sm">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-[#1a1a1a]">{log.note || log.rule_description}</p>
                                    <p className="text-[10px] text-[#5A5A40]/60 uppercase tracking-wider">
                                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                                    </p>
                                  </div>
                                  <div className={`text-sm font-bold ${log.points_change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {log.points_change > 0 ? '+' : ''}{log.points_change}
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteLog(log.id)}
                                    className="ml-4 p-1 text-red-300 hover:text-red-500 transition-colors"
                                    title="Xóa bản ghi này"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* API Config Modal */}
              <AnimatePresence>
                {showApiConfig && (
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden border border-black/5"
                    >
                      <div className="p-6 border-b border-black/5 flex justify-between items-center bg-[#5A5A40] text-white">
                        <h3 className="font-bold flex items-center gap-2">
                          <Key size={18} /> Cấu hình API Key
                        </h3>
                        <button onClick={() => setShowApiConfig(false)} className="p-1 hover:bg-white/20 rounded-lg transition-all">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-6 space-y-6">
                        <div>
                          <p className="text-sm text-[#5A5A40]/80 mb-4">
                            Để sử dụng AI Assistant, bạn cần cung cấp Gemini API Key. Bạn có thể lấy khóa miễn phí tại Google AI Studio.
                          </p>
                          <a 
                            href="https://aistudio.google.com/app/api-keys" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-[#5A5A40] font-bold text-sm hover:underline mb-6"
                          >
                            <Send size={14} /> Lấy API Key tại đây (Google AI Studio)
                          </a>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40]/60">Điền API Key của bạn</label>
                            <input 
                              type="password"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="Dán API Key vào đây..."
                              className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all font-mono text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <button 
                            onClick={() => {
                              localStorage.setItem('gemini_api_key', apiKey);
                              setShowApiConfig(false);
                              alert("Đã lưu API Key thành công!");
                            }}
                            className="flex-1 bg-[#5A5A40] text-white py-3 rounded-xl font-bold hover:bg-[#4A4A30] transition-all shadow-md"
                          >
                            Lưu API Key
                          </button>
                          <button 
                            onClick={async () => {
                              if (window.aistudio) {
                                await window.aistudio.openSelectKey();
                                setShowApiConfig(false);
                              }
                            }}
                            className="flex-1 border border-[#5A5A40] text-[#5A5A40] py-3 rounded-xl font-bold hover:bg-black/5 transition-all"
                          >
                            Chọn từ hệ thống
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col"
            >
              <header className="mb-6">
                <h1 className="text-4xl font-bold text-[#1a1a1a]">AI Assistant</h1>
                <p className="text-[#5A5A40]/60 italic">Nhập hoạt động của học sinh để tự động cập nhật điểm</p>
              </header>

              <div className="flex-1 bg-white rounded-3xl border border-black/5 shadow-sm flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sans">
                  {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-4 text-[#5A5A40]/40">
                        <MessageSquare size={32} />
                      </div>
                      <p className="text-[#5A5A40]/60 italic font-serif">
                        "Bạn ơi, bạn Puih Quân hôm nay đi học muộn."<br/>
                        "Tổ 2 hôm nay trực nhật rất tốt."
                      </p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-[#5A5A40] text-white' : 'bg-black/5 text-[#1a1a1a]'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex justify-start">
                      <div className="bg-black/5 px-4 py-3 rounded-2xl flex items-center gap-2 text-[#5A5A40]/60 italic">
                        <Loader2 size={16} className="animate-spin" />
                        Đang phân tích quy định...
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t border-black/5 flex gap-2">
                  <input 
                    type="text" 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Nhập hoạt động..."
                    className="flex-1 px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-sans"
                  />
                  <button 
                    type="submit"
                    disabled={isProcessing}
                    className="bg-[#5A5A40] text-white p-3 rounded-xl hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'manage' && user.role === 'admin' && (
            <motion.div 
              key="manage"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header>
                <h1 className="text-4xl font-bold text-[#1a1a1a]">Quản lý thành viên</h1>
                <p className="text-[#5A5A40]/60 italic">Thêm hoặc xóa học sinh khỏi các tổ</p>
              </header>

              <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                <h3 className="font-bold text-[#1a1a1a] mb-6">Thêm học sinh mới</h3>
                <form onSubmit={handleAddStudent} className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <input 
                      type="text" 
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="Họ và tên học sinh"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-sans"
                    />
                  </div>
                  <div className="w-40">
                    <select 
                      value={newStudentGroupId}
                      onChange={(e) => setNewStudentGroupId(parseInt(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 font-sans"
                    >
                      <option value={1}>Tổ 1</option>
                      <option value={2}>Tổ 2</option>
                      <option value={3}>Tổ 3</option>
                      <option value={4}>Tổ 4</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    className="bg-[#5A5A40] text-white px-8 py-3 rounded-xl hover:bg-[#4A4A30] transition-colors"
                  >
                    Thêm thành viên
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
                <table className="w-full text-left font-sans">
                  <thead>
                    <tr className="bg-black/5 text-[10px] uppercase tracking-widest text-[#5A5A40]/60">
                      <th className="px-6 py-4">Tên học sinh</th>
                      <th className="px-6 py-4">Tổ</th>
                      <th className="px-6 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {students.map((student) => (
                      <tr key={student.id} className="hover:bg-black/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium">{student.name}</td>
                        <td className="px-6 py-4">{student.group_name}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteStudent(student.id)}
                            className="text-red-500 hover:text-red-700 text-sm font-bold"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
