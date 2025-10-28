/* app.js - main behavior for EcoThreads index.html
   Place alongside index.html and styles.css
*/

(function () {
  // Ensure the global Supabase client exists
  const supabaseClient = window.supabaseClient || null;
  if (!supabaseClient) {
    console.warn('Supabase client not found. Make sure index.html created window.supabaseClient with your keys.');
  }

  /* ---------------------------
     Utility helpers
  --------------------------- */
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  function showToast(msg, timeout = 3500) {
    // quick minimal toast
    let t = document.createElement('div');
    t.textContent = msg;
    t.style.position = 'fixed';
    t.style.right = '18px';
    t.style.bottom = '18px';
    t.style.background = 'rgba(16,167,90,0.98)';
    t.style.color = 'white';
    t.style.padding = '10px 14px';
    t.style.borderRadius = '10px';
    t.style.boxShadow = '0 8px 28px rgba(6,10,8,0.25)';
    t.style.zIndex = 9999;
    document.body.appendChild(t);
    setTimeout(()=> t.remove(), timeout);
  }

  function showModal() {
    const mb = $('#modalBackdrop');
    if (mb) mb.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function hideModal() {
    const mb = $('#modalBackdrop');
    if (mb) mb.classList.remove('show');
    document.body.style.overflow = '';
  }

  function setAuthButtonSignedIn(user) {
    const btn = $('#authBtn');
    if (!btn) return;
    btn.textContent = 'Sign Out';
    btn.classList.remove('outline');
    btn.onclick = async () => {
      if (!supabaseClient) { alert('Supabase client missing'); return; }
      try {
        await supabaseClient.auth.signOut();
        showToast('Signed out');
        updateAuthUI();
      } catch (err) {
        console.error(err);
        alert('Sign out failed');
      }
    };
  }
  function setAuthButtonSignedOut() {
    const btn = $('#authBtn');
    if (!btn) return;
    btn.textContent = 'Sign In';
    btn.classList.add('outline');
    btn.onclick = () => showModal();
  }

  /* ---------------------------
     Auth: sign up / sign in flows
  --------------------------- */
  async function handleSignUp() {
    if (!supabaseClient) { alert('Supabase not configured'); return; }
    const email = $('#signupEmail').value.trim();
    const password = $('#signupPassword').value;
    if (!email || !password) { alert('Enter email and password'); return; }
    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      showToast('Check your email for confirmation (if enabled).');
      hideModal();
      updateAuthUI();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Sign up failed');
    }
  }

  async function handleSignIn() {
    if (!supabaseClient) { alert('Supabase not configured'); return; }
    const email = $('#signinEmail').value.trim();
    const password = $('#signinPassword').value;
    if (!email || !password) { alert('Enter email and password'); return; }
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showToast('Signed in successfully');
      hideModal();
      updateAuthUI();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Sign in failed');
    }
  }

  async function updateAuthUI() {
    if (!supabaseClient) { setAuthButtonSignedOut(); return; }
    try {
      const r = await supabaseClient.auth.getUser();
      const user = r.data ? r.data.user : null;
      if (user) {
        setAuthButtonSignedIn(user);
      } else {
        setAuthButtonSignedOut();
      }
    } catch (err) {
      console.error('auth UI update error', err);
      setAuthButtonSignedOut();
    }
  }

  /* ---------------------------
     Modal tab toggles and wiring
  --------------------------- */
  function setupModal() {
    const tabSignIn = $('#tabSignIn');
    const tabSignUp = $('#tabSignUp');
    const signInForm = $('#signInForm');
    const signUpForm = $('#signUpForm');
    const closeModalBtn = $('#closeModal');

    if (!tabSignIn || !tabSignUp || !signInForm || !signUpForm) return;

    tabSignIn.addEventListener('click', () => {
      tabSignIn.classList.add('active');
      tabSignUp.classList.remove('active');
      signInForm.style.display = 'block';
      signUpForm.style.display = 'none';
    });
    tabSignUp.addEventListener('click', () => {
      tabSignUp.classList.add('active');
      tabSignIn.classList.remove('active');
      signInForm.style.display = 'none';
      signUpForm.style.display = 'block';
    });
    if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);

    // submit buttons
    const btnSignUp = $('#btnSignUp');
    const btnSignIn = $('#btnSignIn');
    if (btnSignUp) btnSignUp.addEventListener('click', handleSignUp);
    if (btnSignIn) btnSignIn.addEventListener('click', handleSignIn);
  }

  /* ---------------------------
     Category card animations and navigation
  --------------------------- */
  function setupCategoryCards() {
    const cards = $all('.category-card');
    // basic entrance animation class already applied in HTML; ensure mounted elements animate by forcing reflow
    setTimeout(() => {
      cards.forEach(c => c.classList.remove('animate-up'));
      // re-add to animate in if desired
      cards.forEach((c, i) => {
        c.style.opacity = '0';
        c.style.transform = 'translateY(10px)';
        setTimeout(() => {
          c.style.transition = 'all 420ms cubic-bezier(.2,.9,.25,1)';
          c.style.opacity = '';
          c.style.transform = '';
        }, 80 + i * 80);
      });
    }, 80);

    // store selected category in localStorage when clicked, so category pages can read it
    cards.forEach(c => {
      c.addEventListener('click', (e) => {
        // if it's an anchor, let default navigation proceed; but save category first.
        const title = c.querySelector('.card-title') ? c.querySelector('.card-title').textContent.trim() : null;
        if (title) localStorage.setItem('ecothreads:selectedCategory', title);
        // allow anchors to navigate
      });
    });
  }

  /* ---------------------------
     Quick list form (upload + insert)
  --------------------------- */
  function setupQuickList() {
    const quickBtn = $('#quickListBtn');
    if (!quickBtn) return;

    quickBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (!supabaseClient) { alert('Supabase not configured — replace placeholders in index.html'); return; }

      // Basic form fields
      const title = $('#qTitle').value.trim();
      const category = $('#qCategory').value;
      const price = $('#qPrice').value.trim();
      const size = $('#qSize').value.trim();
      const description = $('#qDescription').value.trim();
      const files = $('#qPhotos').files;

      // Require auth
      const userResp = await supabaseClient.auth.getUser();
      const user = userResp.data ? userResp.data.user : null;
      if (!user) {
        showToast('Please sign in to list an item');
        showModal();
        return;
      }

      if (!title) { alert('Please enter item title'); return; }

      // Validate files size (max 10MB per file) and limit (max 5)
      const maxFiles = 5;
      const maxSizeBytes = 10 * 1024 * 1024;
      if (files && files.length > maxFiles) {
        alert(`You can upload up to ${maxFiles} images.`);
        return;
      }
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > maxSizeBytes) {
          alert(`File ${files[i].name} is larger than 10MB.`);
          return;
        }
      }

      // Show a simple loading state on the button
      quickBtn.disabled = true;
      const originalText = quickBtn.textContent;
      quickBtn.textContent = 'Uploading...';

      try {
        // Upload files to Supabase Storage 'items' bucket under path items/{user.id}/filename
        const publicUrls = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
          const path = `items/${user.id}/${safeName}`;

          // upload
          const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('items')
            .upload(path, file, { cacheControl: '3600', upsert: false });

          if (uploadError) {
            console.error('Upload error', uploadError);
            throw uploadError;
          }

          // get public URL (convenience)
          const { data: publicData } = supabaseClient.storage.from('items').getPublicUrl(path);
          const publicURL = publicData && publicData.publicUrl ? publicData.publicUrl : (publicData && publicData.publicURL) ? publicData.publicURL : null;
          // UMD getPublicUrl returns { publicURL } in some builds; also check publicUrl
          // If null, try constructing URL with project url (not recommended). We'll push what we have.
          publicUrls.push(publicURL || null);
        }

        // Insert item row into 'items' table
        const record = {
          title,
          category,
          size,
          condition: 'Good', // quick default (you can add a field later)
          price: parseFloat(price) || 0,
          description,
          photos: publicUrls,
          user_id: user.id
        };

        const { data: insertData, error: insertError } = await supabaseClient
          .from('items')
          .insert([record]);

        if (insertError) {
          console.error('Insert error', insertError);
          throw insertError;
        }

        showToast('Item listed successfully');
        // reset form
        $('#qTitle').value = '';
        $('#qPrice').value = '';
        $('#qSize').value = '';
        $('#qDescription').value = '';
        $('#qPhotos').value = '';

      } catch (err) {
        console.error('Quick list error', err);
        alert((err && err.message) || 'Failed to list item. Check console.');
      } finally {
        quickBtn.disabled = false;
        quickBtn.textContent = originalText;
      }
    });
  }

  /* ---------------------------
     Search & start shopping
  --------------------------- */
  function setupSearchAndCTAs() {
    const startShop = $('#startShop');
    const searchBtn = $('#searchBtn');
    const searchInput = $('#searchInput');

    if (startShop) startShop.addEventListener('click', () => {
      // scroll to categories
      const el = document.getElementById('categories');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        const q = searchInput.value.trim();
        if (!q) { showToast('Type something to search'); return; }
        // naive: store search query and open a results page (to implement)
        localStorage.setItem('ecothreads:lastSearch', q);
        // For now navigate to a placeholder search results page (you can implement later)
        window.location.href = `search.html?q=${encodeURIComponent(q)}`;
      });
    }
  }

  /* ---------------------------
     Auth state listener
  --------------------------- */
  function setupAuthListener() {
    if (!supabaseClient || !supabaseClient.auth || !supabaseClient.auth.onAuthStateChange) return;
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      updateAuthUI();
    });
  }

  /* ---------------------------
     Initialize all handlers
  --------------------------- */
  function init() {
    setupModal();
    setupCategoryCards();
    setupQuickList();
    setupSearchAndCTAs();
    setupAuthListener();
    updateAuthUI();

    // make category anchors that point to pages keep selected category saved
    $all('.category-card').forEach(card => {
      const anchor = card.closest('a') || card;
      // anchor click handled in setupCategoryCards
    });

    // minor accessibility: close modal on ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideModal();
    });
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
