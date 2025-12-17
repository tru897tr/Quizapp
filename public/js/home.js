function openSidebar(){
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('no-scroll');
}

function closeSidebar(){
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('no-scroll');
}

async function checkAuth(){
    try{
        const res = await fetch('/api/verify');
        if(res.ok){
            const data = await res.json();
            showUserMenu(data.user.username);
            document.getElementById('sidebarLogin').style.display = 'none';
        }else{
            showLoginButton();
            document.getElementById('sidebarLogin').style.display = 'flex';
        }
    }catch(err){
        showLoginButton();
    }
}

function showUserMenu(username){
    const menu = document.getElementById('userMenu');
    menu.innerHTML = '<div class="user-info"><span>👤 ' + username + '</span></div><button class="btn btn-secondary" onclick="logout()" style="padding:11px 22px;">Đăng xuất</button>';
}

function showLoginButton(){
    const menu = document.getElementById('userMenu');
    menu.innerHTML = '<a href="/login" class="btn btn-primary">Đăng nhập</a>';
}

async function logout(){
    if(confirm('Bạn có chắc muốn đăng xuất?')){
        try{
            await fetch('/api/logout', {method:'POST'});
        }catch(err){}
        window.location.href = '/';
    }
}

window.addEventListener('DOMContentLoaded', checkAuth);
