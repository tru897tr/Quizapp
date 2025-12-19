let quiz=null,currentQuestion=0,startTime=Date.now(),timerInterval,questionStartTime=Date.now(),timePerQuestion=[],userAnswers={};

window.addEventListener('DOMContentLoaded',async()=>{
try{
const response=await fetch('/api/verify');
if(!response.ok){window.location.href='/login';return}
const result=await response.json();
document.getElementById('username').textContent=result.user.username;
const pathParts=window.location.pathname.split('/'),quizId=parseInt(pathParts[2]);
if(isNaN(quizId)){showToast('ID quiz không hợp lệ','error');window.location.href='/';return}
await loadQuiz(quizId);
startTimer();
displayQuestion()
}catch(error){window.location.href='/login'}
});

async function loadQuiz(quizId){
try{
const response=await fetch(`/api/quiz/${quizId}`);
const result=await response.json();
if(!result.success){showToast(result.error,'error');window.location.href='/';return}
quiz=result.quiz;
document.getElementById('totalQ').textContent=quiz.questionCount
}catch(error){showToast('Lỗi tải quiz','error');window.location.href='/'}
}

function startTimer(){
timerInterval=setInterval(()=>{
const elapsed=Math.floor((Date.now()-startTime)/1000),minutes=Math.floor(elapsed/60),seconds=elapsed%60;
document.getElementById('timer').textContent=String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0')
},1000)
}

function displayQuestion(){
const q=quiz.questions[currentQuestion],userAnswer=userAnswers[currentQuestion];
document.getElementById('currentQ').textContent=currentQuestion+1;
document.getElementById('progress').style.width=((currentQuestion)/quiz.questionCount)*100+'%';

// CRITICAL FIX: Support A-F options, not just A-D
let optionsHTML='';
q.options.forEach((opt,idx)=>{
let classes='option',clickable=true;
if(userAnswer!==undefined){
if(userAnswer.correctIndex===idx){classes+=' correct'}
if(userAnswer.wrongAttempts&&userAnswer.wrongAttempts.includes(idx)){classes+=' wrong'}
if(userAnswer.isCorrect){classes+=' disabled';clickable=false}
}
const onclickAttr=clickable?`onclick="checkAnswer(${idx})"`:'';
// Generate label A-F (support up to 6 options)
const label = String.fromCharCode(65+idx);
optionsHTML+=`<div class="${classes}" ${onclickAttr}><div class="option-label">${label}</div><div>${opt.text}</div></div>`
});

const isAnswered=userAnswer&&userAnswer.isCorrect===true,prevDisabled=currentQuestion===0?'disabled':'',nextDisabled=!isAnswered?'disabled':'';
document.getElementById('quizArea').innerHTML=`<div class="question-card"><div class="question-text">${q.question}</div><div class="options-grid">${optionsHTML}</div><div class="quiz-navigation"><button class="nav-button prev" onclick="prevQuestion()" ${prevDisabled}>← Quay lại</button><button class="nav-button next" onclick="nextQuestion()" ${nextDisabled}>Tiếp tục →</button></div></div>`
}

async function checkAnswer(selected){
const q=quiz.questions[currentQuestion];
let userAnswer=userAnswers[currentQuestion]||{wrongAttempts:[],isCorrect:false};
if(userAnswer.isCorrect)return;
if(userAnswer.wrongAttempts.includes(selected))return;
try{
const response=await fetch(`/api/quiz/${quiz.id}/check-answer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionIndex:currentQuestion,selectedOption:selected})});
const result=await response.json();
if(result.isCorrect){
const questionTime=Math.floor((Date.now()-questionStartTime)/1000);
timePerQuestion[currentQuestion]=questionTime;
userAnswers[currentQuestion]={...userAnswer,isCorrect:true,correctIndex:result.correctIndex};
showToast('Chính xác! 🎉','success')
}else{
userAnswer.wrongAttempts.push(selected);
userAnswers[currentQuestion]={...userAnswer,correctIndex:result.correctIndex};
showToast('Sai rồi, thử lại nhé','error')
}
displayQuestion()
}catch(error){showToast('Lỗi kiểm tra câu trả lời','error')}
}

function prevQuestion(){
if(currentQuestion>0){currentQuestion--;displayQuestion()}
}

function nextQuestion(){
if(currentQuestion<quiz.questionCount-1){currentQuestion++;questionStartTime=Date.now();displayQuestion()}else{showResults()}
}

async function showResults(){
clearInterval(timerInterval);
const totalTime=Math.floor((Date.now()-startTime)/1000),minutes=Math.floor(totalTime/60),seconds=totalTime%60,validTimes=timePerQuestion.filter(t=>t!==undefined),avgTime=validTimes.length>0?Math.floor(validTimes.reduce((a,b)=>a+b,0)/validTimes.length):0,fastestTime=validTimes.length>0?Math.min(...validTimes):0,slowestTime=validTimes.length>0?Math.max(...validTimes):0;
try{await fetch('/api/save-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quizId:quiz.id,totalTime,avgTime,fastestTime,slowestTime})})}catch(error){}
document.getElementById('quizStats').style.display='none';
document.querySelector('.progress-bar').style.display='none';
document.getElementById('quizArea').innerHTML=`<div class="result-screen"><div class="result-icon">🏆</div><h1 class="result-title">Chúc mừng!</h1><p style="font-size:18px;color:var(--gray);margin:0 0 20px 0;">Bạn đã hoàn thành bài trắc nghiệm</p><div class="result-time">${minutes}:${String(seconds).padStart(2,'0')}</div><div class="result-stats"><div class="result-stat"><div class="result-stat-label">Trung bình</div><div class="result-stat-value">${avgTime}s</div></div><div class="result-stat"><div class="result-stat-label">Nhanh nhất</div><div class="result-stat-value">${fastestTime}s</div></div><div class="result-stat"><div class="result-stat-label">Chậm nhất</div><div class="result-stat-value">${slowestTime}s</div></div><div class="result-stat"><div class="result-stat-label">Tổng câu</div><div class="result-stat-value">${quiz.questionCount}</div></div></div><div class="result-buttons"><button class="btn btn-primary" onclick="location.reload()">🔄 Làm lại</button><button class="btn btn-secondary" onclick="window.location.href='/'">🏠 Về trang chủ</button></div></div>`
}

function toggleFullscreen(){
if(!document.fullscreenElement){document.documentElement.requestFullscreen().catch(err=>showToast('Không thể vào chế độ toàn màn hình','error'));document.body.classList.add('fullscreen-mode')}else{document.exitFullscreen();document.body.classList.remove('fullscreen-mode')}
}

function exitFullscreen(){if(document.fullscreenElement){document.exitFullscreen()}}

document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){document.body.classList.remove('fullscreen-mode')}});

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.fullscreenElement){exitFullscreen()}});

function quit(){if(confirm('Bạn có chắc muốn thoát? Tiến độ sẽ không được lưu.')){window.location.href='/'}}
