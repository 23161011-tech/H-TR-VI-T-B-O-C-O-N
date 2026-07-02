// ============================================
// ReportAI v2.0 - Technical Report Assistant
// Complete Application JavaScript
// ============================================

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── STATE ───
const State = {
  apiKey: localStorage.getItem('ra_key') || '',
  exaApiKey: localStorage.getItem('ra_exa_key') || '',
  model: localStorage.getItem('ra_model') || 'gemini-2.5-flash',
  temperature: parseFloat(localStorage.getItem('ra_temp') || '0.7'),
  maxTokens: parseInt(localStorage.getItem('ra_tokens') || '8192'),
  activePanel: 'dashboard',
  chatHistory: [],
  isGenerating: false,
  history: JSON.parse(localStorage.getItem('ra_history') || '[]'),
  stats: JSON.parse(localStorage.getItem('ra_stats') || '{"uses":0,"saved":0,"chats":0}'),
  lastOutputs: {},     // panelId -> { raw, html }
  flowchartZoom: 1,
  flowchartLightBg: false,
};

// ─── SYSTEM PROMPT ───
const SYS = `Bạn là Trợ lý Báo cáo Kỹ thuật chuyên nghiệp, chuyên giúp sinh viên kỹ thuật viết, cấu trúc và định dạng báo cáo học thuật.

Trách nhiệm:
1. Tạo nội dung báo cáo kỹ thuật có cấu trúc rõ ràng với giọng văn học thuật.
2. Đề xuất tổ chức báo cáo hợp lý theo chủ đề kỹ thuật.
3. Viết lại văn bản thành văn bản học thuật chính thức.
4. Đảm bảo tính nhất quán, rõ ràng và chuyên nghiệp.
5. Tuân theo phong cách viết học thuật Việt Nam.
6. Cung cấp giải thích ngắn gọn nhưng chính xác về mặt kỹ thuật.
7. Không bịa đặt dữ liệu kỹ thuật; nêu rõ giả định nếu không chắc.
8. Hỗ trợ định dạng Word (tiêu đề, hình, bảng, trích dẫn).

Vai trò: Giảng viên hướng dẫn + Chuyên gia viết kỹ thuật + Chuyên gia định dạng.
Ưu tiên: Rõ ràng > Cấu trúc > Chính xác > Hữu ích thực tế.
Quy tắc: Luôn tiếng Việt, chính xác, có cấu trúc, không mơ hồ. Dùng markdown formatting.`;

// ─── FEATURES CONFIG ───
const FEATURES = {
  'feature-a': {
    icon: '📋', title: 'Tạo Dàn Bài', btn: 'Tạo Dàn Bài',
    required: ['topic', 'field', 'reportType'],
    prompt: d => `[TẠO DÀN BÀI BÁO CÁO]\nTạo dàn bài báo cáo kỹ thuật hoàn chỉnh theo chuẩn học thuật VN.\n- Đề tài: ${d.topic}\n- Lĩnh vực: ${d.field}\n- Loại: ${d.reportType}\n${d.description?`- Mô tả: ${d.description}`:''}\nYêu cầu: Đầy đủ Chương/Mục/Tiểu mục, mỗi phần kèm mô tả ngắn, bao gồm Lời cảm ơn, Mục lục, Danh mục hình/bảng, TLTK, Phụ lục. Đánh số rõ ràng. Tiếng Việt.`
  },
  'feature-b': {
    icon: '✍️', title: 'Viết Nội Dung', btn: 'Viết Nội Dung',
    required: ['sectionTitle', 'topicDesc', 'keyPoints'],
    prompt: d => `[VIẾT NỘI DUNG MỤC]\nViết nội dung chi tiết cho mục báo cáo kỹ thuật.\n- Tiêu đề: ${d.sectionTitle}\n- Đề tài: ${d.topicDesc}\n- Ý chính: ${d.keyPoints}\n${d.context?`- Ngữ cảnh: ${d.context}`:''}\nVăn phong học thuật, thuật ngữ chính xác. Tiếng Việt.`
  },
  'feature-c': {
    icon: '🔄', title: 'Viết Lại Văn Bản', btn: 'Viết Lại',
    required: ['originalText'],
    prompt: d => `[VIẾT LẠI VĂN BẢN HỌC THUẬT]\nViết lại đoạn văn sau thành văn phong học thuật chuyên nghiệp.\n\nVăn bản gốc:\n"""\n${d.originalText}\n"""\n\nYêu cầu: Trang trọng, loại bỏ cách nói không chính thức, giữ nguyên ý. Hiển thị bản viết lại trước, rồi liệt kê thay đổi chính. Tiếng Việt.`
  },
  'feature-d': {
    icon: '🏗️', title: 'Mô Tả Hệ Thống', btn: 'Mô Tả Hệ Thống',
    required: ['projectName', 'components'],
    prompt: d => `[MÔ TẢ KIẾN TRÚC HỆ THỐNG]\nMô tả kiến trúc hệ thống và luồng dữ liệu.\n- Dự án: ${d.projectName}\n- Thành phần: ${d.components}\n${d.description?`- Mô tả: ${d.description}`:''}\nMô tả rõ ràng, luồng dữ liệu từng bước, thuật ngữ kỹ thuật. Tiếng Việt.`
  },
  'feature-e': {
    icon: '🖼️', title: 'Mô Tả Hình Ảnh', btn: 'Tạo Mô Tả',
    required: ['figureNumber', 'figureType', 'figureDesc'],
    prompt: d => `[MÔ TẢ HÌNH ẢNH/SƠ ĐỒ]\nTạo mô tả cho hình ${d.figureNumber}.\n- Loại: ${d.figureType}\n- Nội dung: ${d.figureDesc}\nBắt đầu "Hình ${d.figureNumber} mô tả...". Giải thích rõ thành phần và mối quan hệ. Ngắn gọn, học thuật. Tiếng Việt.`
  },
  'feature-f': {
    icon: '📊', title: 'Viết Kết Luận', btn: 'Viết Kết Luận',
    required: ['projectSummary', 'results'],
    prompt: d => `[VIẾT KẾT LUẬN]\nViết kết luận hoàn chỉnh cho báo cáo kỹ thuật.\n- Tóm tắt: ${d.projectSummary}\n- Kết quả: ${d.results}\n${d.limitations?`- Hạn chế: ${d.limitations}`:''}\nTóm tắt kết quả, nêu đóng góp, hạn chế thực tế, hướng phát triển. Văn phong học thuật. Tiếng Việt.`
  },
  'feature-g': {
    icon: '✅', title: 'Kiểm Tra Chất Lượng', btn: 'Kiểm Tra',
    required: ['content'],
    prompt: d => `[KIỂM TRA CHẤT LƯỢNG BÁO CÁO ĐỒ ÁN]\nĐánh giá toàn diện bản báo cáo sau theo 4 nhóm tiêu chí:
- Nội dung: tính đầy đủ, logic, độ chính xác kỹ thuật, sự thống nhất giữa mục tiêu - phương pháp - kết quả - kết luận.
- Văn phong: giọng văn học thuật, trang trọng, mạch lạc, tránh lặp từ và cách nói không chính thức.
- Trình bày: bố cục, tiêu đề, đoạn văn, bảng/ảnh, chú thích, cách dùng thuật ngữ, độ dễ đọc.
- Cấu trúc: mở đầu, phần thân, kết luận, mục lục, tài liệu tham khảo, tính logic giữa các chương/mục.

Thông tin báo cáo:
- Loại báo cáo: ${d.reportType || 'Không xác định'}
- Ngữ cảnh: ${d.context || 'Không có'}

Nội dung cần đánh giá:\n"""\n${d.content}\n"""\nYêu cầu trả lời bằng tiếng Việt, có cấu trúc rõ ràng với các phần sau:
1. Tóm tắt nhanh chung (2-3 câu)
2. Chấm điểm từng tiêu chí theo thang 0-10 và giải thích ngắn
3. Điểm mạnh nổi bật
4. Các vấn đề cần sửa ưu tiên cao
5. Đề xuất sửa cụ thể cho từng vấn đề, có thể kèm câu văn gợi ý
6. Kết luận cuối cùng: báo cáo đã đủ tốt để nộp chưa? Nếu chưa, cần cải thiện những gì trước tiên.`
  },
  'feature-h': {
    icon: '📐', title: 'Định Dạng Word', btn: 'Tạo Hướng Dẫn',
    required: ['structure'],
    prompt: d => `[HƯỚNG DẪN ĐỊNH DẠNG WORD]\nTạo hướng dẫn định dạng báo cáo trong Microsoft Word.\n- Cấu trúc: ${d.structure}\n${d.requirements?`- Yêu cầu: ${d.requirements}`:''}\nHeading levels, Mục lục tự động, đánh số hình/bảng, font, từng bước cho Word. Tiếng Việt.`
  },
  'feature-i': {
    icon: '💡', title: 'Đề Xuất Cải Tiến', btn: 'Đề Xuất',
    required: ['content'],
    prompt: d => `[ĐỀ XUẤT CẢI TIẾN]\nPhân tích và đề xuất cải thiện:\n"""\n${d.content}\n"""\nXác định nội dung thiếu, đề xuất cải tiến cụ thể, khuyến nghị thêm sơ đồ/giải thích/chi tiết kỹ thuật. Thực tế, có thể thực hiện. Tiếng Việt.`
  },
  'feature-j': {
    icon: '📚', title: 'Tạo Trích Dẫn', btn: 'Tạo Trích Dẫn',
    required: ['citationStyle', 'references'],
    prompt: d => `[TẠO TRÍCH DẪN & TÀI LIỆU THAM KHẢO]\nTạo trích dẫn theo chuẩn ${d.citationStyle}.\n\nThông tin tài liệu:\n${d.references}\n${d.context?`\nNgữ cảnh: ${d.context}`:''}\n\nYêu cầu:\n- Định dạng đúng chuẩn ${d.citationStyle}\n- Sắp xếp theo quy tắc\n- Ghi chú cách trích dẫn trong bài\n- Tiếng Việt`
  },
  'feature-k': {
    icon: '📊', title: 'Tạo Bảng So Sánh', btn: 'Tạo Bảng',
    required: ['comparisonTopic', 'criteria', 'options'],
    prompt: d => `[TẠO BẢNG SO SÁNH]\nTạo bảng so sánh kỹ thuật.\n- Chủ đề: ${d.comparisonTopic}\n- Tiêu chí: ${d.criteria}\n- Phương án: ${d.options}\n${d.context?`- Ngữ cảnh: ${d.context}`:''}\n\nYêu cầu:\n- Tạo bảng markdown đầy đủ\n- Giải thích từng tiêu chí\n- Đưa ra kết luận/khuyến nghị\n- Văn phong học thuật. Tiếng Việt.`
  },
  'feature-l': {
    icon: '🔀', title: 'Vẽ Lưu Đồ', btn: 'Tạo Lưu Đồ',
    required: ['algorithmDesc'],
    prompt: d => `[VẼ LƯU ĐỒ THUẬT TOÁN]\nTạo Mermaid.js code cho lưu đồ dựa trên mô tả sau.\n\n- Loại: ${d.diagramType || 'Lưu đồ thuật toán'}\n- Hướng: ${d.diagramDirection || 'TD'}\n- Mô tả: ${d.algorithmDesc}\n\nQuy tắc QUAN TRỌNG:\n1. CHỈ trả về Mermaid code, KHÔNG có markdown code fence (\`\`\`mermaid).\n2. Code bắt đầu bằng: flowchart ${d.diagramDirection||'TD'} (hoặc sequenceDiagram, stateDiagram-v2, classDiagram tùy loại)\n3. Sử dụng tiếng Việt cho nhãn node\n4. Dùng cú pháp chuẩn Mermaid:\n   - Node vuông: A[Nội dung]\n   - Node tròn: A((Nội dung))\n   - Node thoi (điều kiện): A{Điều kiện}\n   - Node bo góc: A(Nội dung)\n   - Node hình bình hành: A[/Nội dung/]\n   - Node hình thang: A[\\Nội dung\\]\n   - Bắt đầu/Kết thúc dùng node bo tròn: A([Bắt đầu])\n   - Arrow: A --> B, A -->|Có| B\n5. Mỗi node ID phải duy nhất (dùng A, B, C, ...)\n6. KHÔNG dùng ký tự đặc biệt trong ID\n7. Wrap text dài trong ngoặc kép nếu cần\n\nSau Mermaid code, thêm dòng trống rồi viết:\n---DESCRIPTION---\nMô tả lưu đồ bằng văn bản học thuật tiếng Việt (2-3 đoạn) để dùng trong báo cáo.`
  },
  'feature-m': {
    icon: '🧪', title: 'Đánh Giá Tính Nguyên Bản & Văn Phong', btn: 'Đánh Giá',
    required: ['text'],
    prompt: d => `[ĐÁNH GIÁ TÍNH NGUYÊN BẢN & VĂN PHONG]
Đánh giá mức độ độc đáo về cách diễn đạt và phong cách viết của đoạn văn/báo cáo sau.

Nội dung:
"""
${d.text}
"""

Yêu cầu:
1. Nhận định ngắn về mức độ độc đáo về phong cách và cách triển khai ý.
2. Chỉ ra các phần có thể bị xem là thiếu tính nguyên bản về văn phong, nhưng tuyệt đối không khẳng định chắc chắn về đạo văn khi chưa có bằng chứng.
3. Đề xuất các cách paraphrase, đổi cấu trúc câu, đổi từ vựng và tổ chức ý để tăng tính nguyên bản.
4. Trả lời bằng tiếng Việt, thực tế, ngắn gọn và có cấu trúc.`
  },
  'feature-n': {
    icon: '🔎', title: 'Tìm Nguồn Tham Khảo', btn: 'Tìm Nguồn',
    required: ['query'],
    prompt: d => `[TÌM NGUỒN THAM KHẢO]
Dựa trên các kết quả tìm kiếm thực tế sau, hãy chọn ra ${d.count || 5} nguồn phù hợp nhất cho chủ đề/đoạn văn dưới đây.

Chủ đề/đoạn văn:
"""
${d.query}
"""

Kết quả tìm kiếm thực tế:
"""
${d.searchResults || 'Không có kết quả tìm kiếm thực tế.'}
"""

Yêu cầu:
1. Chỉ chọn nguồn có liên quan và đáng tin cậy.
2. Mỗi nguồn gồm: tên tài liệu, tác giả, năm, loại tài liệu, lý do phù hợp.
3. Định dạng các thông tin đó thành trích dẫn hoàn chỉnh theo chuẩn ${d.citationStyle || 'APA'}.
4. Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng và có thể sao chép.`
  },
  'feature-o': {
    icon: '🧠', title: 'Tóm Tắt Tự Động', btn: 'Tóm Tắt',
    required: ['text'],
    prompt: d => `[TÓM TẮT TỰ ĐỘNG]
Hãy tóm tắt văn bản sau thành một bản tóm tắt ngắn gọn, súc tích và học thuật.

Văn bản:
"""
${d.text}
"""

Yêu cầu:
1. Tóm tắt khoảng ${d.length || 100} từ.
2. Giữ nguyên ý chính và cấu trúc logic.
3. Trả lời bằng tiếng Việt, rõ ràng, dễ hiểu.`
  },
};

// ─── QUICK TEMPLATES ───
const TEMPLATES = {
  'iot-temp': { topic: 'Hệ thống giám sát nhiệt độ, độ ẩm sử dụng IoT', field: 'IoT', reportType: 'Đồ án môn học' },
  'smart-home': { topic: 'Hệ thống Smart Home điều khiển qua WiFi', field: 'IoT', reportType: 'Luận văn tốt nghiệp' },
  'app-qlsv': { topic: 'Ứng dụng quản lý sinh viên trên nền tảng web', field: 'CNTT', reportType: 'Đồ án môn học' },
  'robot-line': { topic: 'Robot dò line sử dụng cảm biến hồng ngoại', field: 'Cơ điện tử', reportType: 'Báo cáo Thực tập' },
};

const FLOWCHART_TEMPLATES = {
  'sensor-read': `flowchart TD\n    A([Bắt đầu]) --> B[Khởi tạo cảm biến]\n    B --> C[Đọc giá trị cảm biến]\n    C --> D{Giá trị hợp lệ?}\n    D -->|Có| E[Xử lý dữ liệu]\n    D -->|Không| F[Báo lỗi]\n    F --> C\n    E --> G[Hiển thị kết quả]\n    G --> H{Tiếp tục?}\n    H -->|Có| C\n    H -->|Không| I([Kết thúc])`,
  'login': `flowchart TD\n    A([Bắt đầu]) --> B[Hiển thị form đăng nhập]\n    B --> C[Người dùng nhập tài khoản/mật khẩu]\n    C --> D{Kiểm tra thông tin}\n    D -->|Hợp lệ| E[Đăng nhập thành công]\n    D -->|Không hợp lệ| F{Quá 3 lần?}\n    F -->|Chưa| G[Thông báo lỗi]\n    G --> B\n    F -->|Rồi| H[Khóa tài khoản]\n    E --> I([Kết thúc])\n    H --> I`,
  'mqtt': `flowchart TD\n    A([Bắt đầu]) --> B[Kết nối MQTT Broker]\n    B --> C{Kết nối thành công?}\n    C -->|Không| D[Thử kết nối lại]\n    D --> B\n    C -->|Có| E[Đọc dữ liệu cảm biến]\n    E --> F[Đóng gói JSON]\n    F --> G[Publish lên topic]\n    G --> H{Gửi thành công?}\n    H -->|Có| I[Chờ interval]\n    H -->|Không| J[Lưu vào buffer]\n    I --> E\n    J --> G`,
  'pid-control': `flowchart TD\n    A([Bắt đầu]) --> B[Đặt giá trị setpoint]\n    B --> C[Đọc giá trị thực tế PV]\n    C --> D[Tính sai số e = SP - PV]\n    D --> E[Tính P = Kp × e]\n    E --> F[Tính I = Ki × tổng e]\n    F --> G[Tính D = Kd × delta e]\n    G --> H[Output = P + I + D]\n    H --> I{Output trong giới hạn?}\n    I -->|Không| J[Giới hạn output]\n    I -->|Có| K[Xuất tín hiệu điều khiển]\n    J --> K\n    K --> L[Chờ chu kỳ lấy mẫu]\n    L --> C`,
};

// ─── GEMINI API (Streaming) ───
async function* streamGemini(prompt, isChat = false, history = []) {
  if (!State.apiKey) throw new Error('Vui lòng nhập API Key trong Cài đặt');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${State.model}:streamGenerateContent?alt=sse&key=${State.apiKey}`;
  const contents = [];
  if (isChat && history.length) {
    history.forEach(m => contents.push({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYS }] },
      contents,
      generationConfig: { temperature: State.temperature, maxOutputTokens: State.maxTokens },
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const message = err?.error?.message || `Lỗi API: ${resp.status}${resp.statusText ? ` ${resp.statusText}` : ''}`;
    throw new Error(message);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const data = JSON.parse(jsonStr);
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {}
      }
    }
  }
}

// Non-streaming fallback
async function callGemini(prompt, isChat = false, history = []) {
  if (!State.apiKey) throw new Error('Vui lòng nhập API Key trong Cài đặt');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${State.model}:generateContent?key=${State.apiKey}`;
  const contents = [];
  if (isChat && history.length) {
    history.forEach(m => contents.push({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYS }] },
      contents,
      generationConfig: { temperature: State.temperature, maxOutputTokens: State.maxTokens },
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const message = err?.error?.message || `Lỗi API: ${resp.status}${resp.statusText ? ` ${resp.statusText}` : ''}`;
    throw new Error(message);
  }
  const data = await resp.json();
  if (!data.candidates?.length) throw new Error('Không nhận được phản hồi');
  return data.candidates[0].content.parts[0].text;
}

// ─── RENDER HELPERS ───
function renderMd(text) {
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true,
      highlight: (code, lang) => (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) ? hljs.highlight(code, { language: lang }).value : code,
    });
    return marked.parse(text);
  }
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
}
function escHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// ─── TOAST ───
function toast(msg, type = 'success') {
  const c = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span class="toast-message">${msg}</span><button class="toast-close-btn">&times;</button>`;
  el.querySelector('.toast-close-btn').onclick = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); };
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 4000);
}

// ─── NAVIGATION ───
function switchPanel(id) {
  $$('.nav-btn').forEach(b => { b.classList.toggle('active', b.dataset.target === id); b.removeAttribute('aria-current'); });
  const ab = $(`.nav-btn[data-target="${id}"]`);
  if (ab) ab.setAttribute('aria-current', 'page');
  $$('.feature-panel').forEach(p => p.classList.toggle('active', p.id === id));
  const cfg = FEATURES[id];
  $('#page-title').textContent = id === 'dashboard' ? '🏠 Trang chủ' : id === 'chat-panel' ? '💬 Chat Tự Do' : id === 'history-panel' ? '📜 Lịch Sử' : cfg ? `${cfg.icon} ${cfg.title}` : '';
  State.activePanel = id;
  if (id === 'history-panel') renderHistory();
  if (window.innerWidth < 768) { $('#sidebar').classList.remove('open'); $('#sidebar-overlay').classList.remove('active'); }
}

// ─── FORM DATA ───
function getFormData(pid) {
  const f = $(`#form-${pid}`);
  if (!f) return {};
  const d = {};
  f.querySelectorAll('input,textarea,select').forEach(e => { if (e.name) d[e.name] = e.value.trim(); });
  return d;
}
function validateForm(pid, d) {
  const cfg = FEATURES[pid];
  return cfg ? cfg.required.every(f => d[f]) : false;
}

// ─── PROGRESS BAR ───
function showProgress(on) {
  const bar = $('#progress-bar');
  if (on) bar.classList.add('active'); else bar.classList.remove('active');
}

async function webSearchExa(query) {
  const apiKey = State.exaApiKey || localStorage.getItem('ra_exa_key') || '';
  if (!apiKey) return [];
  try {
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query: `${query} academic paper thesis report`,
        numResults: 5,
        contents: { text: true, maxCharacters: 280 },
      }),
    });
    if (!response.ok) throw new Error(`Exa API lỗi: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.warn('Exa search failed:', err);
    return [];
  }
}

// ─── GENERATE (Streaming) ───
async function handleGenerate(pid) {
  if (State.isGenerating) return toast('Đang xử lý...', 'info');
  const data = getFormData(pid);
  if (!validateForm(pid, data)) return toast('Vui lòng điền đầy đủ các trường bắt buộc', 'error');
  if (!State.apiKey) { toast('Vui lòng nhập API Key', 'error'); return openSettings(); }

  const cfg = FEATURES[pid];
  const letter = pid.split('-')[1];
  const btn = $(`#btn-generate-${letter}`);
  const regenBtn = $(`#btn-regenerate-${letter}`);
  const outputEl = $(`#output-${letter}`);
  const loadingEl = $(`#loading-${letter}`);
  const isFlowchart = pid === 'feature-l';

  State.isGenerating = true;
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  showProgress(true);
  if (loadingEl) { loadingEl.classList.add('active'); }
  if (outputEl) { const ph = outputEl.querySelector('.output-placeholder'); if (ph) ph.style.display = 'none'; }

  try {
    let promptData = { ...data };
    let prompt = cfg.prompt(promptData);

    if (pid === 'feature-n') {
      const searchQuery = `${promptData.query || ''} ${promptData.context || ''}`.trim();
      const results = await webSearchExa(searchQuery);
      const searchResults = results.slice(0, parseInt(promptData.count || 5, 10)).map((item, index) => {
        const title = item.title || 'Không có tiêu đề';
        const url = item.url || 'Không có URL';
        const snippet = (item.text || item.snippet || '').replace(/\s+/g, ' ').trim();
        return `${index + 1}. ${title}\nURL: ${url}\nTóm tắt: ${snippet.slice(0, 280)}`;
      }).join('\n\n');
      promptData = { ...promptData, searchResults: searchResults || 'Không có kết quả tìm kiếm thực tế từ Exa.' };
      prompt = cfg.prompt(promptData);
      if (!searchResults) {
        toast('Không có kết quả tìm kiếm thực tế từ Exa. Hệ thống sẽ dùng thông tin tham khảo nội bộ.', 'info');
      }
    }

    let fullText = '';

    if (isFlowchart) {
      // For flowcharts, use non-streaming to get complete code
      fullText = await callGemini(prompt);
      if (loadingEl) loadingEl.classList.remove('active');
      handleFlowchartResult(fullText, data);
    } else {
      // Streaming for other features
      if (loadingEl) loadingEl.classList.remove('active');
      outputEl.innerHTML = '<div class="markdown-content streaming-cursor"></div>';
      const mdEl = outputEl.querySelector('.markdown-content');

      for await (const chunk of streamGemini(prompt)) {
        fullText += chunk;
        mdEl.innerHTML = renderMd(fullText);
        outputEl.scrollTop = outputEl.scrollHeight;
      }
      mdEl.classList.remove('streaming-cursor');
    }

    // Store output
    State.lastOutputs[pid] = { raw: fullText, html: outputEl?.innerHTML || '' };
    if (outputEl && !isFlowchart) {
      State.lastOutputs[pid].html = outputEl.innerHTML;
    }

    // Save to history
    saveToHistory(pid, data, fullText);

    // Show regenerate button
    if (regenBtn) regenBtn.style.display = 'inline-flex';

    // Update stats
    State.stats.uses++;
    saveStats();
    updateDashboardStats();

    toast('Tạo nội dung thành công!', 'success');

  } catch (err) {
    if (loadingEl) loadingEl.classList.remove('active');
    if (outputEl && !isFlowchart) {
      outputEl.innerHTML = `<div class="error-message"><span class="error-icon">⚠️</span><p>${escHtml(err.message)}</p></div>`;
    }
    toast(err.message, 'error');
  } finally {
    State.isGenerating = false;
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
    showProgress(false);
  }
}

// ─── FLOWCHART HANDLING ───
function handleFlowchartResult(text, data) {
  let mermaidCode = text;
  let description = '';

  // Split mermaid code and description
  const sepIdx = text.indexOf('---DESCRIPTION---');
  if (sepIdx !== -1) {
    mermaidCode = text.substring(0, sepIdx).trim();
    description = text.substring(sepIdx + 17).trim();
  }

  // Clean up: remove markdown fences if present
  mermaidCode = mermaidCode.replace(/```mermaid\s*/gi, '').replace(/```\s*/g, '').trim();

  // Show workspace
  const workspace = $('#flowchart-workspace');
  const actions = $('#flowchart-actions');
  if (workspace) workspace.style.display = 'grid';
  if (actions) actions.style.display = 'flex';

  // Set code editor
  const editor = $('#flowchart-code-editor');
  if (editor) editor.value = mermaidCode;

  // Render preview
  renderMermaid(mermaidCode);

  // Show description in output area
  const outputEl = $('#output-l');
  const loadingEl = $('#loading-l');
  if (loadingEl) loadingEl.classList.remove('active');
  if (outputEl) {
    const ph = outputEl.querySelector('.output-placeholder');
    if (ph) ph.style.display = 'none';
    if (description) {
      outputEl.innerHTML = `<div class="markdown-content">${renderMd(description)}</div>`;
    } else {
      outputEl.innerHTML = '<div class="error-message"><span class="error-icon">⚠️</span><p>Không nhận được mô tả bổ sung từ AI.</p></div>';
    }
  }
}

async function showFlowchartPlaceholder(message) {
  const preview = $('#flowchart-preview-content') || $('#flowchart-preview');
  if (!preview) return;
  preview.innerHTML = `<div class="flowchart-preview-placeholder"><span class="placeholder-icon">🔀</span><p>${escHtml(message)}</p></div>`;
}

async function renderMermaid(code) {
  const preview = $('#flowchart-preview-content') || $('#flowchart-preview');
  if (!preview) return;
  if (!code || !code.trim()) {
    showFlowchartPlaceholder('Lưu đồ sẽ hiển thị tại đây');
    return;
  }

  try {
    preview.innerHTML = '';
    const id = 'mermaid-' + Date.now();
    const { svg } = await mermaid.render(id, code);
    preview.innerHTML = svg;

    const svgEl = preview.querySelector('svg');
    if (svgEl) {
      svgEl.style.transform = `scale(${State.flowchartZoom})`;
      svgEl.style.transformOrigin = 'center top';
      svgEl.style.maxWidth = '100%';
    }
  } catch (err) {
    showFlowchartPlaceholder(`Lỗi Mermaid: ${err.message}`);
  }
}

function exportFlowchartPNG() {
  const preview = $('#flowchart-preview-content') || $('#flowchart-preview');
  const svg = preview?.querySelector('svg');
  if (!svg) return toast('Chưa có lưu đồ', 'error');
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = `flowchart_${Date.now()}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast('Đã xuất PNG!', 'success');
  };
  img.src = url;
}

function exportFlowchartSVG() {
  const preview = $('#flowchart-preview-content') || $('#flowchart-preview');
  const svg = preview?.querySelector('svg');
  if (!svg) return toast('Chưa có lưu đồ', 'error');
  const svgData = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.download = `flowchart_${Date.now()}.svg`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Đã xuất SVG!', 'success');
}

// ─── CHAT ───
function addChatMsg(content, type = 'user') {
  const c = $('#chat-messages');
  const div = document.createElement('div');
  div.className = `chat-message chat-message-${type}`;
  const avatar = type === 'user' ? '👤' : '🤖';
  const body = type === 'user' ? escHtml(content) : renderMd(content);
  div.innerHTML = `<div class="chat-avatar">${avatar}</div><div class="chat-bubble">${body}</div>`;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
  return div;
}

function addTyping() {
  const c = $('#chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message chat-message-ai';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

function removeTyping() { const el = $('#typing-indicator'); if (el) el.remove(); }

async function handleChatSend() {
  const input = $('#chat-input');
  const msg = input.value.trim();
  if (!msg || State.isGenerating) return;
  if (!State.apiKey) { toast('Vui lòng nhập API Key', 'error'); return openSettings(); }

  addChatMsg(msg, 'user');
  State.chatHistory.push({ role: 'user', content: msg });
  input.value = '';
  input.style.height = 'auto';
  $('#chat-send-btn').disabled = true;

  State.isGenerating = true;
  showProgress(true);

  // Streaming chat
  const aiDiv = document.createElement('div');
  aiDiv.className = 'chat-message chat-message-ai';
  aiDiv.innerHTML = `<div class="chat-avatar">🤖</div><div class="chat-bubble"><div class="markdown-content streaming-cursor"></div></div>`;
  $('#chat-messages').appendChild(aiDiv);
  const mdEl = aiDiv.querySelector('.markdown-content');

  try {
    let full = '';
    for await (const chunk of streamGemini(msg, true, State.chatHistory.slice(0, -1))) {
      full += chunk;
      mdEl.innerHTML = renderMd(full);
      $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
    }
    mdEl.classList.remove('streaming-cursor');
    State.chatHistory.push({ role: 'model', content: full });
    State.stats.chats++;
    saveStats();
    updateDashboardStats();
  } catch (err) {
    mdEl.classList.remove('streaming-cursor');
    mdEl.innerHTML = `<p>⚠️ Lỗi: ${escHtml(err.message)}</p>`;
    toast(err.message, 'error');
  } finally {
    State.isGenerating = false;
    showProgress(false);
    $('#chat-send-btn').disabled = false;
    input.focus();
  }
}

function clearChat() {
  State.chatHistory = [];
  $('#chat-messages').innerHTML = `
    <div class="chat-message chat-message-ai"><div class="chat-avatar">🤖</div><div class="chat-bubble">
      <p>Xin chào! Tôi là <strong>ReportAI</strong> - trợ lý viết báo cáo kỹ thuật. 👋</p>
      <p>Bạn có thể hỏi tôi về:</p><ul><li>📝 Cách viết báo cáo</li><li>📐 Quy cách trình bày</li><li>🔧 Thuật ngữ chuyên ngành</li><li>💡 Ý tưởng đề tài</li></ul>
    </div></div>`;
  toast('Đã xóa lịch sử chat', 'success');
}

// ─── HISTORY ───
function saveToHistory(pid, data, result) {
  const cfg = FEATURES[pid];
  if (!cfg) return;
  const item = {
    id: Date.now().toString(),
    feature: pid,
    icon: cfg.icon,
    title: data.topic || data.sectionTitle || data.projectName || data.comparisonTopic || data.algorithmDesc?.slice(0, 50) || cfg.title,
    preview: result.slice(0, 200),
    result,
    time: new Date().toLocaleString('vi-VN'),
  };
  State.history.unshift(item);
  if (State.history.length > 50) State.history.pop();
  localStorage.setItem('ra_history', JSON.stringify(State.history));
  State.stats.saved = State.history.length;
  saveStats();
}

function renderHistory() {
  const list = $('#history-list');
  const empty = $('#history-empty');
  const count = $('#history-count');
  if (!list) return;

  if (State.history.length === 0) {
    if (empty) empty.style.display = 'block';
    if (count) count.textContent = '0 mục';
    list.querySelectorAll('.history-item').forEach(i => i.remove());
    return;
  }

  if (empty) empty.style.display = 'none';
  if (count) count.textContent = `${State.history.length} mục`;

  // Remove old items
  list.querySelectorAll('.history-item').forEach(i => i.remove());

  State.history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span class="history-item-icon">${item.icon}</span>
      <div class="history-item-info">
        <div class="history-item-title">${escHtml(item.title)}</div>
        <div class="history-item-meta">${item.time}</div>
        <div class="history-item-preview">${escHtml(item.preview)}</div>
      </div>
      <button class="history-item-delete" data-id="${item.id}" title="Xóa">🗑️</button>
    `;
    // Click to view detail
    div.querySelector('.history-item-info').addEventListener('click', () => showHistoryDetail(item));
    div.querySelector('.history-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(item.id);
    });
    list.appendChild(div);
  });
}

function showHistoryDetail(item) {
  const modal = $('#history-detail-modal');
  if (!modal) return;
  $('#history-detail-title').textContent = `${item.icon} ${item.title}`;
  $('#history-detail-content').innerHTML = `<div class="markdown-content">${renderMd(item.result)}</div>`;
  modal.classList.add('active');
}

function deleteHistoryItem(id) {
  State.history = State.history.filter(i => i.id !== id);
  localStorage.setItem('ra_history', JSON.stringify(State.history));
  State.stats.saved = State.history.length;
  saveStats();
  renderHistory();
  toast('Đã xóa', 'success');
}

function clearHistory() {
  if (!confirm('Xóa tất cả lịch sử?')) return;
  State.history = [];
  localStorage.setItem('ra_history', '[]');
  State.stats.saved = 0;
  saveStats();
  renderHistory();
  toast('Đã xóa tất cả lịch sử', 'success');
}

// ─── STATS ───
function saveStats() { localStorage.setItem('ra_stats', JSON.stringify(State.stats)); }
function updateDashboardStats() {
  const su = $('#stat-total-uses'); if (su) su.textContent = State.stats.uses;
  const ss = $('#stat-saved'); if (ss) ss.textContent = State.stats.saved;
  const sc = $('#stat-chat'); if (sc) sc.textContent = State.stats.chats;
}

// ─── EXPORT ───
function getOutputText(outputId) {
  if (outputId === 'output-l') {
    const el = $('#output-l');
    return el ? (el.innerText || el.textContent || '').trim() : '';
  }

  const el = $(`#${outputId}`);
  if (!el) return '';

  const stored = Object.entries(State.lastOutputs).find(([pid]) => {
    const letter = pid.split('-')[1];
    return `output-${letter}` === outputId;
  });

  if (stored?.[1]?.raw) return stored[1].raw;
  if (el.tagName === 'TEXTAREA') return el.value;
  return el.innerText || el.textContent || '';
}

async function copyOutput(outputId) {
  const text = getOutputText(outputId).trim();
  if (!text) return toast('Chưa có nội dung', 'error');

  try { await navigator.clipboard.writeText(text); toast('Đã sao chép!', 'success'); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Đã sao chép!', 'success');
  }
}

function exportFile(format, outputId) {
  const text = getOutputText(outputId);
  if (!text.trim()) return toast('Chưa có nội dung', 'error');

  let blob, ext;
  if (format === 'txt') {
    blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    ext = 'txt';
  } else if (format === 'md') {
    blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    ext = 'md';
  } else if (format === 'docx') {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:'Times New Roman',serif;font-size:13pt;line-height:1.5;}h1{font-size:16pt;font-weight:bold;}h2{font-size:14pt;font-weight:bold;}h3{font-size:13pt;font-weight:bold;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #000;padding:6px 8px;}th{background:#f0f0f0;font-weight:bold;}</style></head><body>${renderMd(text)}</body></html>`;
    blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    ext = 'docx';
  }

  if (blob) {
    const a = document.createElement('a');
    a.download = `reportai_${outputId}_${Date.now()}.${ext}`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Đã xuất .${ext}!`, 'success');
  }
}

// ─── FULLSCREEN OUTPUT ───
function toggleFullscreen(wrapperId) {
  const el = $(`#${wrapperId}`);
  if (!el) return;
  el.classList.toggle('fullscreen');
  if (el.classList.contains('fullscreen')) {
    // Add ESC handler
    el._escHandler = (e) => { if (e.key === 'Escape') { el.classList.remove('fullscreen'); document.removeEventListener('keydown', el._escHandler); } };
    document.addEventListener('keydown', el._escHandler);
  }
}

// ─── WORD COUNTER ───
function updateWordCount(textarea) {
  const wrapper = textarea.closest('.textarea-wrapper');
  if (!wrapper) return;
  const counter = wrapper.querySelector('.word-counter');
  if (!counter) return;
  const text = textarea.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  counter.textContent = `${words} từ`;
}

async function readUploadedReportFile(file) {
  const name = (file?.name || '').toLowerCase();
  if (!file) throw new Error('Vui lòng chọn một file');

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return await file.text();
  }

  if (name.endsWith('.docx')) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Thư viện đọc DOCX chưa sẵn sàng. Vui lòng thử lại sau.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }

  throw new Error('Định dạng tệp chưa được hỗ trợ. Vui lòng chọn .txt, .md hoặc .docx.');
}

async function handleQualityFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await readUploadedReportFile(file);
    const textarea = $('#field-g-content');
    const label = $('#field-g-file-name');
    if (textarea) {
      textarea.value = text.trim();
      textarea.dispatchEvent(new Event('input'));
    }
    if (label) label.textContent = `Đã chọn: ${file.name}`;
    toast(`Đã đọc nội dung từ ${file.name}`, 'success');
  } catch (err) {
    const label = $('#field-g-file-name');
    if (label) label.textContent = 'Không thể đọc file';
    toast(err.message, 'error');
  }
}

// ─── SETTINGS ───
function openSettings() {
  const m = $('#settings-modal');
  m.classList.add('active');
  $('#setting-api-key').value = State.apiKey;
  $('#setting-exa-key').value = State.exaApiKey;
  $('#setting-model').value = State.model;
  $('#setting-temperature').value = State.temperature;
  $('#temperature-value').textContent = State.temperature.toFixed(1);
  $('#setting-max-tokens').value = State.maxTokens;
}
function closeSettings() { $('#settings-modal').classList.remove('active'); }
function saveSettings() {
  State.apiKey = $('#setting-api-key').value.trim();
  State.exaApiKey = $('#setting-exa-key').value.trim();
  State.model = $('#setting-model').value;
  State.temperature = parseFloat($('#setting-temperature').value);
  State.maxTokens = parseInt($('#setting-max-tokens').value) || 8192;
  localStorage.setItem('ra_key', State.apiKey);
  localStorage.setItem('ra_exa_key', State.exaApiKey);
  localStorage.setItem('ra_model', State.model);
  localStorage.setItem('ra_temp', State.temperature.toString());
  localStorage.setItem('ra_tokens', State.maxTokens.toString());
  updateApiStatus();
  closeSettings();
  toast('Đã lưu cài đặt!', 'success');
}
function updateApiStatus() {
  const dot = $('#status-dot'), txt = $('#status-text');
  if (State.apiKey) { dot.className = 'status-dot connected'; txt.textContent = 'API Connected'; }
  else { dot.className = 'status-dot disconnected'; txt.textContent = 'Chưa kết nối'; }
}

// ─── INITIALIZATION ───
function init() {
  // Initialize Mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#6366f1',
        primaryTextColor: '#f1f5f9',
        primaryBorderColor: '#8b5cf6',
        lineColor: '#94a3b8',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        fontFamily: 'Inter, sans-serif',
      },
      flowchart: { htmlLabels: true, curve: 'basis' },
      securityLevel: 'loose',
    });
  }

  // Nav
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchPanel(b.dataset.target)));

  // Dashboard cards
  $$('.dashboard-card').forEach(c => c.addEventListener('click', () => switchPanel(c.dataset.target)));

  // Form submissions
  $$('.feature-form').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); handleGenerate(f.closest('.feature-panel').id); }));

  // Regenerate buttons
  $$('.btn-regenerate').forEach(b => b.addEventListener('click', () => handleGenerate(b.closest('.feature-panel').id)));

  // Copy buttons
  $$('.btn-copy').forEach(b => b.addEventListener('click', () => copyOutput(b.dataset.output)));

  // Export dropdown toggles
  $$('.btn-export-trigger').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = b.closest('.export-dropdown');
      $$('.export-dropdown').forEach(d => { if (d !== dd) d.classList.remove('open'); });
      dd.classList.toggle('open');
    });
  });

  // Export menu items
  $$('.export-menu-item').forEach(b => {
    b.addEventListener('click', () => {
      exportFile(b.dataset.format, b.dataset.output);
      b.closest('.export-dropdown').classList.remove('open');
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', () => $$('.export-dropdown').forEach(d => d.classList.remove('open')));

  // Fullscreen buttons
  $$('.btn-fullscreen').forEach(b => b.addEventListener('click', () => toggleFullscreen(b.dataset.target)));

  // Word counters
  $$('.feature-form textarea').forEach(ta => {
    ta.addEventListener('input', () => updateWordCount(ta));
  });

  // Quality review file upload
  $('#field-g-file')?.addEventListener('change', handleQualityFileUpload);

  // Quick templates (Feature A)
  $$('.template-chip[data-template]').forEach(chip => {
    chip.addEventListener('click', () => {
      const tpl = TEMPLATES[chip.dataset.template];
      if (!tpl) return;
      const form = chip.closest('.feature-panel')?.querySelector('.feature-form');
      if (!form) return;
      Object.entries(tpl).forEach(([k, v]) => {
        const el = form.querySelector(`[name="${k}"]`);
        if (el) { el.value = v; el.dispatchEvent(new Event('input')); }
      });
      toast('Đã áp dụng mẫu!', 'info');
    });
  });

  // Flowchart templates
  $$('.template-chip[data-flowchart-template]').forEach(chip => {
    chip.addEventListener('click', () => {
      const code = FLOWCHART_TEMPLATES[chip.dataset.flowchartTemplate];
      if (!code) return;
      const editor = $('#flowchart-code-editor');
      if (editor) editor.value = code;
      const workspace = $('#flowchart-workspace');
      const actions = $('#flowchart-actions');
      if (workspace) workspace.style.display = 'grid';
      if (actions) actions.style.display = 'flex';
      renderMermaid(code);
      toast('Đã tải mẫu lưu đồ!', 'info');
    });
  });

  // Flowchart controls
  $('#btn-update-preview')?.addEventListener('click', () => {
    const code = $('#flowchart-code-editor')?.value;
    if (code) renderMermaid(code);
  });

  $('#btn-toggle-bg')?.addEventListener('click', () => {
    State.flowchartLightBg = !State.flowchartLightBg;
    const preview = $('#flowchart-preview-content') || $('#flowchart-preview');
    if (preview) preview.classList.toggle('light-bg', State.flowchartLightBg);
    // Re-render with appropriate theme
    const code = $('#flowchart-code-editor')?.value;
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false,
        theme: State.flowchartLightBg ? 'default' : 'dark',
        themeVariables: State.flowchartLightBg ? {} : {
          primaryColor: '#6366f1', primaryTextColor: '#f1f5f9',
          primaryBorderColor: '#8b5cf6', lineColor: '#94a3b8',
          secondaryColor: '#1e293b', tertiaryColor: '#0f172a',
          fontFamily: 'Inter, sans-serif',
        },
        flowchart: { htmlLabels: true, curve: 'basis' },
        securityLevel: 'loose',
      });
    }
    if (code) renderMermaid(code);
  });

  $('#btn-zoom-in')?.addEventListener('click', () => {
    State.flowchartZoom = Math.min(State.flowchartZoom + 0.2, 3);
    const preview = $('#flowchart-preview-content') || $('#flowchart-preview');
    const svg = preview?.querySelector('svg');
    if (svg) svg.style.transform = `scale(${State.flowchartZoom})`;
  });

  $('#btn-zoom-out')?.addEventListener('click', () => {
    State.flowchartZoom = Math.max(State.flowchartZoom - 0.2, 0.3);
    const preview = $('#flowchart-preview-content') || $('#flowchart-preview');
    const svg = preview?.querySelector('svg');
    if (svg) svg.style.transform = `scale(${State.flowchartZoom})`;
  });

  $('#btn-export-png')?.addEventListener('click', exportFlowchartPNG);
  $('#btn-export-svg')?.addEventListener('click', exportFlowchartSVG);

  $('#btn-fullscreen-diagram')?.addEventListener('click', () => {
    const workspace = $('#flowchart-workspace');
    if (workspace) {
      workspace.classList.toggle('fullscreen');
      if (workspace.classList.contains('fullscreen')) {
        workspace._esc = (e) => { if (e.key === 'Escape') { workspace.classList.remove('fullscreen'); document.removeEventListener('keydown', workspace._esc); } };
        document.addEventListener('keydown', workspace._esc);
      }
    }
  });

  // Chat
  const chatInput = $('#chat-input');
  const chatSendBtn = $('#chat-send-btn');
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      chatSendBtn.disabled = !chatInput.value.trim();
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } });
  }
  chatSendBtn?.addEventListener('click', handleChatSend);
  $('#btn-clear-chat')?.addEventListener('click', clearChat);

  // History
  $('#btn-clear-history')?.addEventListener('click', clearHistory);
  $('#history-detail-close')?.addEventListener('click', () => $('#history-detail-modal').classList.remove('active'));
  $('#history-detail-close-btn')?.addEventListener('click', () => $('#history-detail-modal').classList.remove('active'));
  $('#history-detail-modal')?.addEventListener('click', e => { if (e.target.id === 'history-detail-modal') $('#history-detail-modal').classList.remove('active'); });

  // Settings
  $('#settings-btn')?.addEventListener('click', openSettings);
  $('#modal-close-btn')?.addEventListener('click', closeSettings);
  $('#btn-modal-cancel')?.addEventListener('click', closeSettings);
  $('#btn-modal-save')?.addEventListener('click', saveSettings);
  $('#settings-modal')?.addEventListener('click', e => { if (e.target.id === 'settings-modal') closeSettings(); });
  $('#setting-temperature')?.addEventListener('input', e => { $('#temperature-value').textContent = parseFloat(e.target.value).toFixed(1); });
  $('#btn-toggle-api-key')?.addEventListener('click', () => {
    const inp = $('#setting-api-key'), ico = $('#eye-icon');
    if (inp.type === 'password') { inp.type = 'text'; ico.textContent = '🙈'; }
    else { inp.type = 'password'; ico.textContent = '👁️'; }
  });

  // Mobile
  $('#mobile-menu-btn')?.addEventListener('click', () => { $('#sidebar').classList.toggle('open'); $('#sidebar-overlay').classList.toggle('active'); });
  $('#sidebar-overlay')?.addEventListener('click', () => { $('#sidebar').classList.remove('open'); $('#sidebar-overlay').classList.remove('active'); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSettings(); $$('.export-dropdown').forEach(d => d.classList.remove('open')); }
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openSettings(); }
  });

  // Init state
  updateApiStatus();
  updateDashboardStats();
  switchPanel('dashboard');

  if (!State.apiKey) {
    setTimeout(() => toast('Hãy nhập API Key để bắt đầu sử dụng', 'info'), 800);
  }

  console.log('🚀 ReportAI v2.0 initialized!');
}

document.addEventListener('DOMContentLoaded', init);
