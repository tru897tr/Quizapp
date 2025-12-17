let questions = [];

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/verify');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();
        document.getElementById('userDisplay').textContent = result.user.username;
        addQuestion();
    } catch (error) {
        window.location.href = '/login';
    }
});

document.getElementById('publicToggle').addEventListener('change', (e) => {
    const status = document.getElementById('visibilityStatus');
    status.textContent = e.target.checked ? 'Công khai' : 'Riêng tư';
});

function addQuestion() {
    const questionIndex = questions.length;
    questions.push({
        question: '',
        options: [
            { text: '', isCorrect: false },
            { text: '', isCorrect: false }
        ]
    });
    renderQuestions();
    setTimeout(() => {
        const newQuestion = document.querySelector(`[data-question-index="${questionIndex}"]`);
        if (newQuestion) {
            newQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const input = newQuestion.querySelector('.question-input');
            if (input) input.focus();
        }
    }, 100);
}

function deleteQuestion(index) {
    if (questions.length === 1) {
        showMessage('Phải có ít nhất một câu hỏi', 'error');
        return;
    }
    if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
        questions.splice(index, 1);
        renderQuestions();
    }
}

function addOption(questionIndex) {
    if (questions[questionIndex].options.length >= 6) {
        showMessage('Tối đa 6 đáp án cho mỗi câu hỏi', 'error');
        return;
    }
    questions[questionIndex].options.push({ text: '', isCorrect: false });
    renderQuestions();
}

function deleteOption(questionIndex, optionIndex) {
    if (questions[questionIndex].options.length <= 2) {
        showMessage('Phải có ít nhất 2 đáp án', 'error');
        return;
    }
    questions[questionIndex].options.splice(optionIndex, 1);
    renderQuestions();
}

function updateQuestion(index, value) {
    questions[index].question = value;
}

function updateOption(questionIndex, optionIndex, value) {
    questions[questionIndex].options[optionIndex].text = value;
}

function toggleCorrect(questionIndex, optionIndex) {
    const currentCorrect = questions[questionIndex].options.filter(o => o.isCorrect).length;
    const isChecked = questions[questionIndex].options[optionIndex].isCorrect;
    
    if (!isChecked && currentCorrect >= 1) {
        showMessage('Chỉ được chọn 1 đáp án đúng', 'error');
        renderQuestions();
        return;
    }
    
    questions[questionIndex].options[optionIndex].isCorrect = !isChecked;
    renderQuestions();
}

function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    
    questions.forEach((q, qIndex) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        questionDiv.setAttribute('data-question-index', qIndex);
        
        let optionsHTML = '';
        q.options.forEach((opt, oIndex) => {
            const label = String.fromCharCode(65 + oIndex);
            const canDelete = q.options.length > 2;
            optionsHTML += `
                <div class="option-item">
                    <div class="option-label-badge">${label}</div>
                    <input type="text" class="option-input" placeholder="Nhập đáp án ${label}" 
                           value="${opt.text}" 
                           oninput="updateOption(${qIndex}, ${oIndex}, this.value)">
                    <div class="correct-checkbox-wrapper">
                        <input type="checkbox" class="correct-checkbox" 
                               ${opt.isCorrect ? 'checked' : ''}
                               onchange="toggleCorrect(${qIndex}, ${oIndex})"
                               title="Đáp án đúng">
                    </div>
                    ${canDelete ? `<button class="delete-option-btn" onclick="deleteOption(${qIndex}, ${oIndex})" title="Xóa đáp án">✕</button>` : '<div style="width:32px"></div>'}
                </div>
            `;
        });
        
        questionDiv.innerHTML = `
            <div class="question-header">
                <div class="question-number">Câu hỏi ${qIndex + 1}</div>
                <button class="delete-question-btn" onclick="deleteQuestion(${qIndex})" title="Xóa câu hỏi">✕</button>
            </div>
            <div class="question-input-group">
                <textarea class="question-input" placeholder="Nhập câu hỏi của bạn..." 
                          oninput="updateQuestion(${qIndex}, this.value)">${q.question}</textarea>
            </div>
            <div class="options-list">
                ${optionsHTML}
            </div>
            <button class="add-option-btn" onclick="addOption(${qIndex})" 
                    ${q.options.length >= 6 ? 'disabled' : ''}>
                + Thêm câu trả lời ${q.options.length >= 6 ? '(Tối đa 6)' : ''}
            </button>
        `;
        
        container.appendChild(questionDiv);
    });
}

async function saveQuiz() {
    const title = document.getElementById('quizTitle').value.trim();
    const isPublic = document.getElementById('publicToggle').checked;
    
    if (!title) {
        showMessage('Vui lòng nhập tiêu đề quiz', 'error');
        document.getElementById('quizTitle').focus();
        return;
    }
    
    if (questions.length === 0) {
        showMessage('Vui lòng thêm ít nhất một câu hỏi', 'error');
        return;
    }
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        if (!q.question.trim()) {
            showMessage(`Câu hỏi ${i + 1}: Vui lòng nhập nội dung câu hỏi`, 'error');
            return;
        }
        
        if (q.options.length < 2) {
            showMessage(`Câu hỏi ${i + 1}: Cần ít nhất 2 đáp án`, 'error');
            return;
        }
        
        for (let j = 0; j < q.options.length; j++) {
            if (!q.options[j].text.trim()) {
                showMessage(`Câu hỏi ${i + 1}: Đáp án ${String.fromCharCode(65 + j)} không được để trống`, 'error');
                return;
            }
        }
        
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
            showMessage(`Câu hỏi ${i + 1}: Phải chọn đúng 1 đáp án đúng`, 'error');
            return;
        }
    }
    
    try {
        const response = await fetch('/api/quiz/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, questions, isPublic })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(result.message, 'success');
            setTimeout(() => {
                window.location.href = '/myactivities';
            }, 1500);
        } else {
            showMessage(result.error, 'error');
        }
    } catch (error) {
        showMessage('Lỗi kết nối', 'error');
    }
}

function showMessage(text, type) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = 'message ' + type + ' show';
    msg.style.position = 'fixed';
    msg.style.top = '20px';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.zIndex = '10000';
    msg.style.maxWidth = '90%';
    msg.style.width = 'auto';
    
    setTimeout(() => {
        msg.className = 'message';
    }, 3000);
}
