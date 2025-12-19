window.addEventListener('DOMContentLoaded',async()=>{
try{
const response=await fetch('/api/verify');
if(!response.ok){window.location.href='/login';return}
const result=await response.json();
document.getElementById('userDisplay').textContent=result.user.username;
loadQuizzes()
}catch(error){window.location.href='/login'}
});

async function loadQuizzes(){
try{
const response=await fetch('/api/quiz/my-activities');
const result=await response.json();
if(result.success){renderQuizzes(result.quizzes)}
}catch(error){showToast('Lỗi tải danh sách','error')}
}

function renderQuizzes(quizzes){
const grid=document.getElementById('quizGrid'),emptyState=document.getElementById('emptyState');
if(quizzes.length===0){grid.style.display='none';emptyState.style.display='block';return}
grid.style.display='grid';emptyState.style.display='none';grid.innerHTML='';
quizzes.forEach(quiz=>{
const card=document.createElement('div');
card.className='quiz-card';
const date=new Date(quiz.createdAt).toLocaleDateString('vi-VN');
card.innerHTML=`<div class="quiz-card-header"><div><h3 class="quiz-card-title">${escapeHtml(quiz.title)}</h3><div class="quiz-card-meta"><span>📝 ${quiz.questionCount} câu hỏi</span><span>📅 ${date}</span></div></div></div><div class="quiz-status ${quiz.isPublic?'public':'private'}">${quiz.isPublic?'🌐 Công khai':'🔒 Riêng tư'}</div><div class="quiz-actions"><button class="menu-trigger" data-quiz-id="${quiz.id}">⋮</button><div class="dropdown-menu" id="menu-${quiz.id}"><button onclick="openQuiz(${quiz.id},'${escapeHtml(quiz.title).replace(/'/g,"\\'")}')">▶️ Làm bài</button><button onclick="openInNewTab(event,${quiz.id},'${escapeHtml(quiz.title).replace(/'/g,"\\'")}')">🔗 Mở tab mới</button><button onclick="editQuiz(event,${quiz.id})">📝 Sửa câu hỏi</button><button onclick="duplicateQuiz(event,${quiz.id})">📋 Nhân đôi</button><button onclick="toggleVisibility(event,${quiz.id},${quiz.isPublic})">${quiz.isPublic?'🔒 Chuyển riêng tư':'🌐 Chuyển công khai'}</button><button onclick="shareQuiz(event,${quiz.id},${quiz.isPublic})" ${quiz.isPublic?'':'disabled style="opacity:0.5"'}>📤 Chia sẻ</button><button class="danger" onclick="deleteQuiz(event,${quiz.id})">🗑️ Xóa</button></div></div>`;
grid.appendChild(card)
});
document.querySelectorAll('.menu-trigger').forEach(btn=>{
btn.addEventListener('click',function(e){
e.stopPropagation();
const quizId=this.dataset.quizId,menu=document.getElementById('menu-'+quizId);
document.querySelectorAll('.dropdown-menu').forEach(m=>m.classList.remove('show'));
menu.classList.add('show')
})
})
}

function escapeHtml(text){const div=document.createElement('div');div.textContent=text;return div.innerHTML}

document.addEventListener('click',()=>{document.querySelectorAll('.dropdown-menu').forEach(m=>m.classList.remove('show'))});

function openQuiz(quizId,title){window.location.href=`/quiz/${quizId}/${encodeURIComponent(title)}`}
function openInNewTab(event,quizId,title){event.stopPropagation();window.open(`/quiz/${quizId}/${encodeURIComponent(title)}`,'_blank')}
function editQuiz(event,quizId){event.stopPropagation();window.location.href=`/create/edit/${quizId}`}

async function duplicateQuiz(event,quizId){
event.stopPropagation();
if(!confirm('Bạn có chắc muốn nhân đôi quiz này?'))return;
try{
const response=await fetch(`/api/quiz/${quizId}/duplicate`,{method:'POST'});
const result=await response.json();
if(result.success){showToast('Đã nhân đôi quiz','success');loadQuizzes()}else{showToast(result.error,'error')}
}catch(error){showToast('Lỗi kết nối','error')}
}

async function toggleVisibility(event,quizId,currentPublic){
event.stopPropagation();
const newStatus=!currentPublic,action=newStatus?'công khai':'riêng tư';
if(!confirm(`Bạn có chắc muốn chuyển quiz sang chế độ ${action}?`))return;
try{
const response=await fetch(`/api/quiz/${quizId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({isPublic:newStatus})});
const result=await response.json();
if(result.success){showToast('Đã thay đổi chế độ','success');loadQuizzes()}else{showToast(result.error,'error')}
}catch(error){showToast('Lỗi kết nối','error')}
}

function shareQuiz(event,quizId,isPublic){
event.stopPropagation();
if(!isPublic){showToast('Quiz phải ở chế độ công khai','error');return}
const shareUrl=window.location.origin+'/share/quiz/'+quizId;
if(navigator.clipboard){navigator.clipboard.writeText(shareUrl).then(()=>{showToast('Đã sao chép link!','success')}).catch(()=>{prompt('Link chia sẻ:',shareUrl)})}else{prompt('Link chia sẻ:',shareUrl)}
}

async function deleteQuiz(event,quizId){
event.stopPropagation();
if(!confirm('Bạn có chắc muốn xóa quiz này?'))return;
try{
const response=await fetch(`/api/quiz/${quizId}`,{method:'DELETE'});
const result=await response.json();
if(result.success){showToast('Đã xóa quiz','success');loadQuizzes()}else{showToast(result.error,'error')}
}catch(error){showToast('Lỗi kết nối','error')}
}
