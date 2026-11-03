(() => {
  "use strict";

  const CSRF_HEADER_NAME = "X-Requested-With";
  const CSRF_HEADER_VALUE = "DavidsAdmin";
  const WORKFORCE_ROLES = new Set(["admin", "support", "auditor"]);

  const state = {
    adminId: null,
    email: null,
    role: null,
    activeView: "directory",
    directory: [],
    admins: [],
    adminAudits: [],
    changeAudits: [],
    adminAuditOutcomeFilter: "all",
    changeAuditSourceFilter: "all",
    changeAuditSearch: "",
    selectedCustomer: null,
    selectedCustomerCiam: null,
    directorySearchTimer: null,
    directoryRequestId: 0,
    toastTimer: null
  };

  const el = id => document.getElementById(id);

  const dom = {
    workspace: el("workspace"),
    navDirectory: el("nav-directory"),
    navAdmins: el("nav-admins"),
    navAudits: el("nav-audits"),
    breadcrumbTitle: el("breadcrumb-title"),
    roleAccessChip: el("role-access-chip"),
    refreshWorkspace: el("refresh-workspace"),
    userAvatar: el("user-avatar"),
    userName: el("user-name"),
    userRole: el("user-role"),
    logoutButton: el("logout-button"),
    toast: el("toast"),
    footerYear: el("footer-year"),

    directoryView: el("directory-view"),
    directoryRefresh: el("directory-refresh"),
    directoryModeCopy: el("directory-mode-copy"),
    directoryTotal: el("directory-total"),
    directoryValidCount: el("directory-valid-count"),
    directoryAttentionCount: el("directory-attention-count"),
    directoryVipCount: el("directory-vip-count"),
    directorySearch: el("directory-search"),
    directoryStateFilter: el("directory-state-filter"),
    directoryVipFilter: el("directory-vip-filter"),
    directoryClearFilters: el("directory-clear-filters"),
    directoryLoading: el("directory-loading"),
    directoryError: el("directory-error"),
    directoryTableWrap: el("directory-table-wrap"),
    directoryTableBody: el("directory-table-body"),
    directoryEmpty: el("directory-empty"),

    adminsView: el("admins-view"),
    adminsRefresh: el("admins-refresh"),
    adminSelfEmail: el("admin-self-email"),
    adminSelfId: el("admin-self-id"),
    adminsTotalCount: el("admins-total-count"),
    adminsLoading: el("admins-loading"),
    adminsError: el("admins-error"),
    adminsTableWrap: el("admins-table-wrap"),
    adminsTableBody: el("admins-table-body"),
    provisionAdminCard: el("provision-admin-card"),
    createAdminForm: el("create-admin-form"),
    newAdminEmail: el("new-admin-email"),
    newAdminFullName: el("new-admin-full-name"),
    newAdminRole: el("new-admin-role"),
    newAdminPassword: el("new-admin-password"),
    createAdminMessage: el("create-admin-message"),
    createAdminSubmit: el("create-admin-submit"),
    selfPasswordForm: el("self-password-form"),
    selfCurrentPassword: el("self-current-password"),
    selfNewPassword: el("self-new-password"),
    selfPasswordMessage: el("self-password-message"),
    selfPasswordSubmit: el("self-password-submit"),
    adminAuditCount: el("admin-audit-count"),
    adminAuditOutcomeFilter: el("admin-audit-outcome-filter"),
    adminAuditsTableBody: el("admin-audits-tbody"),

    auditsView: el("audits-view"),
    auditsRefresh: el("audits-refresh"),
    changeAuditsCount: el("change-audits-count"),
    changeAuditsSearch: el("change-audits-search"),
    changeAuditsSourceFilter: el("change-audits-source-filter"),
    changeAuditsLoading: el("change-audits-loading"),
    changeAuditsError: el("change-audits-error"),
    changeAuditsTableBody: el("change-audits-tbody"),

    customerModal: el("customer-modal"),
    modalBackdrop: el("modal-backdrop"),
    modalTitle: el("modal-title"),
    modalId: el("modal-id"),
    modalCopyId: el("modal-copy-id"),
    modalClose: el("modal-close"),
    modalLoading: el("modal-loading"),
    modalContent: el("modal-content"),
    modalStatePill: el("modal-state-pill"),
    modalVipBadge: el("modal-vip-badge"),
    modalCreated: el("modal-created"),
    modalOrdersCount: el("modal-orders-count"),
    modalOrdersSection: el("modal-orders-section"),
    modalOrdersList: el("modal-orders-list"),
    modalAccountSupport: el("modal-account-support"),
    modalCiamStatus: el("modal-ciam-status"),
    modalUnlockLogin: el("modal-unlock-login"),
    modalCiamEmailRow: el("modal-ciam-email-row"),
    modalCiamEmailInput: el("modal-ciam-email-input"),
    modalSaveCiamEmail: el("modal-save-ciam-email"),
    modalEditForm: el("modal-edit-form"),
    modalNameInput: el("modal-name-input"),
    modalEmailInput: el("modal-email-input"),
    modalAddressInput: el("modal-address-input"),
    modalStateSelect: el("modal-state-select"),
    modalSaveState: el("modal-save-state"),
    modalMessage: el("modal-message"),
    modalResetEdit: el("modal-reset-edit"),
    modalEditSubmit: el("modal-edit-submit"),
    modalCustomerAuditsSection: el("modal-customer-audits-section"),
    modalCustomerAuditsList: el("modal-customer-audits-list"),
    modalDone: el("modal-done")
  };

  function canMutateCustomers() {
    return state.role === "admin" || state.role === "support";
  }

  function isIamAdmin() {
    return state.role === "admin";
  }

  function showMessage(node, text, kind = "error") {
    if (!node) {
      return;
    }

    if (!text) {
      node.hidden = true;
      node.textContent = "";
      node.classList.remove("success");
      return;
    }

    node.textContent = text;
    node.classList.toggle("success", kind === "success");
    node.hidden = false;
  }

  function showToast(text) {
    if (!dom.toast || !text) {
      return;
    }

    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }

    dom.toast.textContent = text;
    dom.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 3200);
  }

  function redirectToLogin(reason) {
    const target = reason ? `/login?reason=${encodeURIComponent(reason)}` : "/login";
    window.location.replace(target);
  }

  function friendlyApiError(status, payload, fallbackMessage) {
    const code = payload?.code || payload?.Code || "";
    const reason = payload?.reason || payload?.Reason || payload?.detail || payload?.title || "";

    if (code === "email_in_use") {
      return reason || "An account with that email address already exists.";
    }
    if (code === "customer_email_in_use" || status === 409) {
      return reason || "Another customer record already uses that email address.";
    }
    if (code === "last_active_admin") {
      return reason || "At least one active administrator account must remain enabled.";
    }
    if (code === "invalid_credentials") {
      return reason || "Current password was incorrect.";
    }
    if (code === "invalid_customer_email" || code === "invalid_email") {
      return reason || "Please enter a valid email address.";
    }
    if (code === "invalid_password") {
      return reason || "Password must be at least 12 characters and distinct from your current password.";
    }
    if (code === "invalid_customer_full_name") {
      return reason || "Full name is required (up to 200 characters).";
    }
    if (code === "invalid_customer_address") {
      return reason || "Address is required (up to 500 characters).";
    }
    if (code === "cannot_change_customer_state" || code === "invalid_customer_state_filter") {
      return reason || "That customer state change is not allowed.";
    }
    if (status === 401) {
      return "Your workforce session expired. Please sign in again.";
    }
    if (status === 403) {
      return reason || "Your workforce role is not permitted to perform this action.";
    }
    if (reason) {
      return reason;
    }

    return fallbackMessage || `Request failed (${status}).`;
  }

  async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    headers.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);

    if (options.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    let data = null;
    const contentType = response.headers.get("content-type") || "";
    if (response.status !== 204 && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    return { ok: response.ok, status: response.status, data };
  }

  function updateIdentityHeader() {
    const label = state.email || "Employee";
    const roleLabel = state.role || "admin";
    dom.userName.textContent = label;
    dom.userRole.textContent = roleLabel;
    dom.userAvatar.textContent = label.trim().charAt(0).toUpperCase() || "A";

    if (dom.adminSelfEmail) {
      dom.adminSelfEmail.textContent = label;
    }
    if (dom.adminSelfId) {
      dom.adminSelfId.textContent = state.adminId
        ? `Role: ${roleLabel} · ID ${state.adminId}`
        : `Verified ${roleLabel} session`;
    }
    if (dom.provisionAdminCard) {
      dom.provisionAdminCard.hidden = !isIamAdmin();
    }
    if (dom.directoryModeCopy) {
      dom.directoryModeCopy.textContent = canMutateCustomers()
        ? "Select any customer row or click Edit customer to update profile details, account standing, or sign-in lockout status."
        : "Signed in with read-only auditor permissions. Select any customer row to inspect profile details, CIAM standing, and mutation history.";
    }
  }

  function switchView(view) {
    const target = view === "admins" || view === "audits" ? view : "directory";
    state.activeView = target;

    dom.directoryView.hidden = target !== "directory";
    dom.adminsView.hidden = target !== "admins";
    if (dom.auditsView) {
      dom.auditsView.hidden = target !== "audits";
    }

    dom.navDirectory.classList.toggle("active", target === "directory");
    dom.navAdmins.classList.toggle("active", target === "admins");
    if (dom.navAudits) {
      dom.navAudits.classList.toggle("active", target === "audits");
    }

    dom.breadcrumbTitle.textContent = target === "admins"
      ? "Workforce IAM"
      : target === "audits"
        ? "Unified Change Audit Trail"
        : "Customer Directory";
  }

  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function stateClassName(customerState) {
    const normalized = String(customerState || "").trim().toLowerCase();
    if (normalized === "valid" || normalized === "incomplete" || normalized === "suspicious" || normalized === "locked") {
      return `state-pill state-${normalized}`;
    }
    return "state-pill state-unknown";
  }

  function applyStatePill(node, customerState) {
    if (!node) {
      return;
    }

    const label = String(customerState || "unknown").trim().toLowerCase();
    node.className = stateClassName(label);
    node.textContent = label;
  }

  function buildDirectoryQuery(filters = {}) {
    const params = new URLSearchParams();
    const search = String(filters.search ?? dom.directorySearch?.value ?? "").trim();
    const stateFilter = String(filters.state ?? dom.directoryStateFilter?.value ?? "").trim().toLowerCase();
    const vipFilter = String(filters.vip ?? dom.directoryVipFilter?.value ?? "").trim().toLowerCase();

    if (search) {
      params.set("search", search);
    }
    if (stateFilter) {
      params.set("state", stateFilter);
    }
    if (vipFilter === "true" || vipFilter === "false") {
      params.set("vip", vipFilter);
    }

    const query = params.toString();
    return query ? `/customers?${query}` : "/customers";
  }

  function getActiveDirectoryFilters() {
    return {
      search: String(dom.directorySearch?.value ?? "").trim(),
      state: String(dom.directoryStateFilter?.value ?? "").trim(),
      vip: String(dom.directoryVipFilter?.value ?? "").trim()
    };
  }

  function updateClearFiltersVisibility() {
    const filters = getActiveDirectoryFilters();
    const hasAnyFilter = Boolean(filters.search || filters.state || filters.vip);
    dom.directoryClearFilters.hidden = !hasAnyFilter;
  }

  function updateDirectoryKpis(customers) {
    const items = Array.isArray(customers) ? customers : [];
    let validCount = 0;
    let attentionCount = 0;
    let vipCount = 0;

    for (const item of items) {
      const normalizedState = String(item.state || item.State || "").toLowerCase();
      if (normalizedState === "valid") {
        validCount += 1;
      } else {
        attentionCount += 1;
      }

      if (Boolean(item.isVip ?? item.IsVip)) {
        vipCount += 1;
      }
    }

    dom.directoryTotal.textContent = String(items.length);
    dom.directoryValidCount.textContent = String(validCount);
    dom.directoryAttentionCount.textContent = String(attentionCount);
    dom.directoryVipCount.textContent = String(vipCount);
  }

  function renderDirectoryRows(customers) {
    dom.directoryTableBody.replaceChildren();
    const items = Array.isArray(customers) ? customers : [];

    updateDirectoryKpis(items);
    updateClearFiltersVisibility();

    if (items.length === 0) {
      dom.directoryEmpty.hidden = false;
      const filters = getActiveDirectoryFilters();
      dom.directoryEmpty.textContent = (filters.search || filters.state || filters.vip)
        ? "No customers match the current search or filter criteria."
        : "No customer records have been registered yet.";
      return;
    }

    dom.directoryEmpty.hidden = true;

    for (const item of items) {
      const id = String(item.id || item.Id || "");
      const fullName = String(item.fullName || item.FullName || "").trim();
      const email = String(item.email || item.Email || "").trim();
      const address = String(item.address || item.Address || "").trim();
      const customerState = String(item.state || item.State || "unknown").toLowerCase();
      const isVip = Boolean(item.isVip ?? item.IsVip);
      const createdAt = item.createdAt || item.CreatedAt;
      const completedOrdersCount = Number(item.completedOrdersCount ?? item.CompletedOrdersCount ?? 0);

      const tr = document.createElement("tr");

      const customerTd = document.createElement("td");
      const primaryWrap = document.createElement("div");
      primaryWrap.className = "customer-primary-cell";

      const nameBtn = document.createElement("button");
      nameBtn.type = "button";
      nameBtn.className = fullName
        ? "customer-name-button"
        : "customer-name-button customer-name-unset";
      nameBtn.textContent = fullName || "Incomplete profile (unnamed)";
      nameBtn.addEventListener("click", () => openCustomerModal(id));
      primaryWrap.appendChild(nameBtn);

      if (email) {
        const emailLine = document.createElement("span");
        emailLine.className = "customer-email-sub";
        emailLine.textContent = email;
        primaryWrap.appendChild(emailLine);
      }

      const idLine = document.createElement("span");
      idLine.className = "customer-id-meta";
      idLine.textContent = id;
      primaryWrap.appendChild(idLine);

      customerTd.appendChild(primaryWrap);
      tr.appendChild(customerTd);

      const addressTd = document.createElement("td");
      addressTd.className = address
        ? "customer-address-cell"
        : "customer-address-cell customer-address-empty";
      addressTd.textContent = address || "Not provided yet";
      tr.appendChild(addressTd);

      const statusTd = document.createElement("td");
      const statusStack = document.createElement("div");
      statusStack.className = "status-stack";

      const pill = document.createElement("span");
      applyStatePill(pill, customerState);
      statusStack.appendChild(pill);

      if (isVip) {
        const vip = document.createElement("span");
        vip.className = "vip-badge";
        vip.textContent = "VIP";
        statusStack.appendChild(vip);
      }

      if (completedOrdersCount > 0) {
        const orders = document.createElement("span");
        orders.className = "orders-mini";
        orders.textContent = `${completedOrdersCount} order${completedOrdersCount === 1 ? "" : "s"}`;
        statusStack.appendChild(orders);
      }

      statusTd.appendChild(statusStack);
      tr.appendChild(statusTd);

      const createdTd = document.createElement("td");
      createdTd.textContent = formatDateTime(createdAt);
      tr.appendChild(createdTd);

      const actionTd = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "table-action";
      editBtn.textContent = canMutateCustomers() ? "Edit customer" : "Inspect record";
      editBtn.addEventListener("click", () => openCustomerModal(id));
      actionTd.appendChild(editBtn);
      tr.appendChild(actionTd);

      dom.directoryTableBody.appendChild(tr);
    }
  }

  async function loadDirectory(options = {}) {
    const requestId = ++state.directoryRequestId;
    const silent = Boolean(options.silent);

    showMessage(dom.directoryError, "");
    updateClearFiltersVisibility();

    if (!silent) {
      dom.directoryLoading.hidden = false;
      dom.directoryTableWrap.hidden = true;
    }

    try {
      const url = buildDirectoryQuery();
      const response = await apiRequest(url);
      if (requestId !== state.directoryRequestId) {
        return;
      }

      if (response.status === 401) {
        redirectToLogin("expired");
        return;
      }

      if (!response.ok) {
        showMessage(
          dom.directoryError,
          friendlyApiError(response.status, response.data, "Could not load the customer directory.")
        );
        renderDirectoryRows([]);
        dom.directoryTableWrap.hidden = false;
        return;
      }

      state.directory = Array.isArray(response.data) ? response.data : [];
      renderDirectoryRows(state.directory);
      dom.directoryTableWrap.hidden = false;
    } catch {
      if (requestId !== state.directoryRequestId) {
        return;
      }
      showMessage(dom.directoryError, "Network error while loading the customer directory.");
      dom.directoryTableWrap.hidden = false;
    } finally {
      if (requestId === state.directoryRequestId) {
        dom.directoryLoading.hidden = true;
      }
    }
  }

  function scheduleDirectorySearch() {
    if (state.directorySearchTimer) {
      clearTimeout(state.directorySearchTimer);
    }

    updateClearFiltersVisibility();
    state.directorySearchTimer = window.setTimeout(() => {
      loadDirectory();
    }, 240);
  }

  function clearDirectoryFilters() {
    dom.directorySearch.value = "";
    dom.directoryStateFilter.value = "";
    dom.directoryVipFilter.value = "";
    updateClearFiltersVisibility();
    loadDirectory();
  }

  async function updateWorkforceAccount(userId, patch) {
    const response = await apiRequest(`/admin-identity/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: patch
    });

    if (response.status === 401) {
      redirectToLogin("expired");
      return;
    }

    if (!response.ok) {
      showMessage(dom.adminsError, friendlyApiError(response.status, response.data, "Could not update employee account."));
      return;
    }

    showToast("Workforce account updated.");
    await loadAdmins();
  }

  async function unlockWorkforceAccount(userId) {
    const response = await apiRequest(`/admin-identity/users/${encodeURIComponent(userId)}/unlock`, {
      method: "POST"
    });

    if (response.status === 401) {
      redirectToLogin("expired");
      return;
    }

    if (!response.ok) {
      showMessage(dom.adminsError, friendlyApiError(response.status, response.data, "Could not unlock employee account."));
      return;
    }

    showToast("Workforce account unlocked.");
    await loadAdmins();
  }

  function renderAdminRows(admins) {
    dom.adminsTableBody.replaceChildren();
    const items = Array.isArray(admins) ? admins : [];
    dom.adminsTotalCount.textContent = String(items.length);

    for (const item of items) {
      const id = String(item.id || item.Id || "");
      const email = String(item.email || item.Email || "");
      const fullName = String(item.fullName || item.FullName || "").trim();
      const role = String(item.role || item.Role || "admin");
      const isActive = Boolean(item.isActive ?? item.IsActive ?? true);
      const lockedOutUntil = item.lockedOutUntilUtc || item.LockedOutUntilUtc || null;
      const isLockedOut = Boolean(lockedOutUntil && new Date(lockedOutUntil).getTime() > Date.now());
      const createdAt = item.createdAt || item.CreatedAt;

      const tr = document.createElement("tr");

      const emailTd = document.createElement("td");
      const wrap = document.createElement("div");
      wrap.className = "customer-primary-cell";
      const strong = document.createElement("strong");
      strong.textContent = fullName ? `${fullName} (${email})` : email;
      wrap.appendChild(strong);
      const idMeta = document.createElement("span");
      idMeta.className = "customer-id-meta";
      idMeta.textContent = id;
      wrap.appendChild(idMeta);
      emailTd.appendChild(wrap);
      tr.appendChild(emailTd);

      const roleTd = document.createElement("td");
      const stack = document.createElement("div");
      stack.className = "status-stack";
      const pill = document.createElement("span");
      pill.className = isActive ? "state-pill state-valid" : "state-pill state-locked";
      pill.textContent = isActive ? role : `${role} (disabled)`;
      stack.appendChild(pill);
      if (isLockedOut) {
        const lockPill = document.createElement("span");
        lockPill.className = "state-pill state-suspicious";
        lockPill.textContent = "locked out";
        stack.appendChild(lockPill);
      }
      roleTd.appendChild(stack);
      tr.appendChild(roleTd);

      const createdTd = document.createElement("td");
      createdTd.textContent = formatDateTime(createdAt);
      tr.appendChild(createdTd);

      const controlsTd = document.createElement("td");
      if (isIamAdmin()) {
        const actionWrap = document.createElement("div");
        actionWrap.className = "inline-iam-controls";

        const roleSelect = document.createElement("select");
        roleSelect.className = "filter-select";
        roleSelect.setAttribute("aria-label", `Change role for ${email}`);
        for (const r of ["admin", "support", "auditor"]) {
          const opt = document.createElement("option");
          opt.value = r;
          opt.textContent = r;
          opt.selected = r === role;
          roleSelect.appendChild(opt);
        }
        roleSelect.addEventListener("change", () => updateWorkforceAccount(id, { role: roleSelect.value }));
        actionWrap.appendChild(roleSelect);

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "table-action";
        toggleBtn.textContent = isActive ? "Disable" : "Enable";
        toggleBtn.addEventListener("click", () => updateWorkforceAccount(id, { isActive: !isActive }));
        actionWrap.appendChild(toggleBtn);

        if (isLockedOut) {
          const unlockBtn = document.createElement("button");
          unlockBtn.type = "button";
          unlockBtn.className = "table-action";
          unlockBtn.textContent = "Unlock";
          unlockBtn.addEventListener("click", () => unlockWorkforceAccount(id));
          actionWrap.appendChild(unlockBtn);
        }

        controlsTd.appendChild(actionWrap);
      } else {
        controlsTd.textContent = "Read-only";
      }
      tr.appendChild(controlsTd);

      dom.adminsTableBody.appendChild(tr);
    }
  }

  function renderAdminAuditRows() {
    if (!dom.adminAuditsTableBody) {
      return;
    }

    dom.adminAuditsTableBody.replaceChildren();
    const items = Array.isArray(state.adminAudits) ? state.adminAudits : [];
    const filtered = items.filter(entry => {
      const ok = Boolean(entry.succeeded ?? entry.Succeeded);
      if (state.adminAuditOutcomeFilter === "succeeded") {
        return ok;
      }
      if (state.adminAuditOutcomeFilter === "failed") {
        return !ok;
      }
      return true;
    });

    if (dom.adminAuditCount) {
      dom.adminAuditCount.textContent = String(filtered.length);
    }

    if (!filtered.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "table-empty";
      td.textContent = "No matching administrator login audit records.";
      tr.appendChild(td);
      dom.adminAuditsTableBody.appendChild(tr);
      return;
    }

    for (const entry of filtered) {
      const succeeded = Boolean(entry.succeeded ?? entry.Succeeded);
      const occurredAt = entry.occurredAtUtc || entry.OccurredAtUtc;
      const email = String(entry.email || entry.Email || "—");
      const outcomeRaw = String(entry.outcome || entry.Outcome || (succeeded ? "succeeded" : "failed"));
      const failureReason = entry.failureReason || entry.FailureReason || "";
      const clientIp = String(entry.clientIpAddress || entry.ClientIpAddress || "unknown");
      const clientId = String(entry.clientId || entry.ClientId || "—");
      const correlationId = String(entry.correlationId || entry.CorrelationId || "");

      const tr = document.createElement("tr");

      const timeTd = document.createElement("td");
      timeTd.textContent = formatDateTime(occurredAt);
      tr.appendChild(timeTd);

      const emailTd = document.createElement("td");
      emailTd.textContent = email;
      tr.appendChild(emailTd);

      const outcomeTd = document.createElement("td");
      const pill = document.createElement("span");
      const pillTone = succeeded
        ? "state-valid"
        : (outcomeRaw === "account_locked" || outcomeRaw === "account_disabled" ? "state-locked" : "state-suspicious");
      pill.className = `state-pill ${pillTone}`;
      pill.textContent = outcomeRaw.replace(/_/g, " ");
      outcomeTd.appendChild(pill);
      if (!succeeded && failureReason) {
        const reason = document.createElement("small");
        reason.className = "audit-reason";
        reason.textContent = String(failureReason);
        outcomeTd.appendChild(reason);
      }
      tr.appendChild(outcomeTd);

      const ipTd = document.createElement("td");
      const ipCode = document.createElement("code");
      ipCode.textContent = clientIp;
      ipTd.appendChild(ipCode);
      tr.appendChild(ipTd);

      const clientTd = document.createElement("td");
      const clientCode = document.createElement("code");
      clientCode.textContent = clientId;
      clientTd.appendChild(clientCode);
      tr.appendChild(clientTd);

      const corrTd = document.createElement("td");
      const corrCode = document.createElement("code");
      corrCode.textContent = correlationId ? correlationId.slice(0, 16) : "—";
      if (correlationId) {
        corrCode.title = correlationId;
      }
      corrTd.appendChild(corrCode);
      tr.appendChild(corrTd);

      dom.adminAuditsTableBody.appendChild(tr);
    }
  }

  async function loadAdmins() {
    showMessage(dom.adminsError, "");
    dom.adminsLoading.hidden = false;
    dom.adminsTableWrap.hidden = true;

    try {
      const [response, auditsResponse] = await Promise.all([
        apiRequest("/admin-identity/users"),
        apiRequest("/admin-identity/login-audits?limit=50")
      ]);
      if (response.status === 401) {
        redirectToLogin("expired");
        return;
      }

      if (!response.ok) {
        showMessage(
          dom.adminsError,
          friendlyApiError(response.status, response.data, "Could not load workforce accounts.")
        );
        return;
      }

      state.admins = Array.isArray(response.data) ? response.data : [];
      state.adminAudits = auditsResponse.ok && Array.isArray(auditsResponse.data) ? auditsResponse.data : [];
      renderAdminRows(state.admins);
      renderAdminAuditRows();
      dom.adminsTableWrap.hidden = false;
    } catch {
      showMessage(dom.adminsError, "Network error while loading workforce accounts.");
    } finally {
      dom.adminsLoading.hidden = true;
    }
  }

  async function handleCreateAdmin(event) {
    event.preventDefault();
    if (!isIamAdmin()) {
      showMessage(dom.createAdminMessage, "Only administrators can provision workforce accounts.");
      return;
    }

    const email = dom.newAdminEmail.value.trim();
    const fullName = dom.newAdminFullName ? dom.newAdminFullName.value.trim() : "";
    const role = dom.newAdminRole ? dom.newAdminRole.value : "admin";
    const password = dom.newAdminPassword.value;

    if (!email || !email.includes("@")) {
      showMessage(dom.createAdminMessage, "Please enter a valid employee email address.");
      return;
    }
    if (!password || password.length < 12) {
      showMessage(dom.createAdminMessage, "Workforce password must be at least 12 characters.");
      return;
    }

    dom.createAdminSubmit.disabled = true;
    showMessage(dom.createAdminMessage, "");

    try {
      const response = await apiRequest("/admin-identity/users", {
        method: "POST",
        body: { email, password, role, fullName: fullName || null }
      });

      if (response.status === 401) {
        redirectToLogin("expired");
        return;
      }

      if (!response.ok) {
        showMessage(
          dom.createAdminMessage,
          friendlyApiError(response.status, response.data, "Could not provision employee account.")
        );
        return;
      }

      dom.newAdminEmail.value = "";
      if (dom.newAdminFullName) {
        dom.newAdminFullName.value = "";
      }
      dom.newAdminPassword.value = "";
      showMessage(dom.createAdminMessage, `Provisioned ${role} account.`, "success");
      showToast("Workforce account provisioned in adminidentitydb.");
      await loadAdmins();
    } catch {
      showMessage(dom.createAdminMessage, "Network error while provisioning employee account.");
    } finally {
      dom.createAdminSubmit.disabled = false;
    }
  }

  async function handleSelfPasswordChange(event) {
    event.preventDefault();
    const currentPassword = dom.selfCurrentPassword.value;
    const newPassword = dom.selfNewPassword.value;

    if (!currentPassword || !newPassword || newPassword.length < 12) {
      showMessage(dom.selfPasswordMessage, "Enter your current password and a new password of at least 12 characters.");
      return;
    }

    dom.selfPasswordSubmit.disabled = true;
    showMessage(dom.selfPasswordMessage, "");

    try {
      const response = await apiRequest("/admin-identity/me/password", {
        method: "PUT",
        body: { currentPassword, newPassword }
      });

      if (!response.ok) {
        showMessage(
          dom.selfPasswordMessage,
          friendlyApiError(response.status, response.data, "Could not rotate password.")
        );
        return;
      }

      dom.selfCurrentPassword.value = "";
      dom.selfNewPassword.value = "";
      showMessage(dom.selfPasswordMessage, "Password rotated and prior tokens revoked. Redirecting to sign in…", "success");
      window.setTimeout(() => handleSignOut(), 900);
    } catch {
      showMessage(dom.selfPasswordMessage, "Network error while rotating password.");
    } finally {
      dom.selfPasswordSubmit.disabled = false;
    }
  }

  function normalizeChangeEntry(source, raw) {
    const targetId = String(raw.targetUserId || raw.targetCustomerId || raw.TargetUserId || raw.TargetCustomerId || "");
    const targetEmail = String(raw.targetEmail || raw.TargetEmail || "");
    const action = String(raw.action || raw.Action || "");
    const actorSub = String(raw.actorSub || raw.ActorSub || "");
    const actorEmail = String(raw.actorEmail || raw.ActorEmail || "");
    const actorRole = String(raw.actorRole || raw.ActorRole || "");
    const actorAuthority = String(raw.actorAuthority || raw.ActorAuthority || "");
    const occurredAtUtc = raw.occurredAtUtc || raw.OccurredAtUtc || null;
    const correlationId = String(raw.correlationId || raw.CorrelationId || "");
    const changes = Array.isArray(raw.changes || raw.Changes) ? (raw.changes || raw.Changes) : [];
    return {
      source,
      targetId,
      targetEmail,
      action,
      actorSub,
      actorEmail,
      actorRole,
      actorAuthority,
      occurredAtUtc,
      correlationId,
      changes
    };
  }

  function renderChangeAudits() {
    if (!dom.changeAuditsTableBody) {
      return;
    }

    dom.changeAuditsTableBody.replaceChildren();
    const term = state.changeAuditSearch.trim().toLowerCase();
    const filtered = state.changeAudits.filter(entry => {
      if (state.changeAuditSourceFilter !== "all" && entry.source !== state.changeAuditSourceFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const diffText = entry.changes
        .map(c => `${c.field || c.Field || ""}:${c.oldValue ?? c.OldValue ?? ""}->${c.newValue ?? c.NewValue ?? ""}`)
        .join(" ")
        .toLowerCase();
      return (
        entry.targetEmail.toLowerCase().includes(term) ||
        entry.targetId.toLowerCase().includes(term) ||
        entry.action.toLowerCase().includes(term) ||
        entry.actorSub.toLowerCase().includes(term) ||
        entry.actorEmail.toLowerCase().includes(term) ||
        entry.actorAuthority.toLowerCase().includes(term) ||
        diffText.includes(term)
      );
    });

    if (dom.changeAuditsCount) {
      dom.changeAuditsCount.textContent = String(filtered.length);
    }

    if (!filtered.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "table-empty";
      td.textContent = "No change audit entries match the current filters.";
      tr.appendChild(td);
      dom.changeAuditsTableBody.appendChild(tr);
      return;
    }

    for (const entry of filtered) {
      const tr = document.createElement("tr");

      const timeTd = document.createElement("td");
      timeTd.textContent = formatDateTime(entry.occurredAtUtc);
      tr.appendChild(timeTd);

      const srcTd = document.createElement("td");
      const srcPill = document.createElement("span");
      srcPill.className = "state-pill state-valid";
      srcPill.textContent = entry.source;
      srcTd.appendChild(srcPill);
      tr.appendChild(srcTd);

      const targetTd = document.createElement("td");
      const targetStack = document.createElement("div");
      targetStack.className = "customer-primary-cell";
      const actStrong = document.createElement("strong");
      actStrong.textContent = entry.action.replace(/_/g, " ");
      targetStack.appendChild(actStrong);
      const emailSpan = document.createElement("span");
      emailSpan.className = "customer-email-sub";
      emailSpan.textContent = entry.targetEmail || entry.targetId;
      targetStack.appendChild(emailSpan);
      targetTd.appendChild(targetStack);
      tr.appendChild(targetTd);

      const actorTd = document.createElement("td");
      const actorStack = document.createElement("div");
      actorStack.className = "customer-primary-cell";
      const authLine = document.createElement("strong");
      authLine.textContent = `${entry.actorAuthority} (${entry.actorRole})`;
      actorStack.appendChild(authLine);
      const subSpan = document.createElement("span");
      subSpan.className = "customer-id-meta";
      subSpan.textContent = entry.actorEmail || entry.actorSub;
      actorStack.appendChild(subSpan);
      actorTd.appendChild(actorStack);
      tr.appendChild(actorTd);

      const diffTd = document.createElement("td");
      const diffWrap = document.createElement("div");
      diffWrap.className = "diff-chip-list";
      for (const ch of entry.changes) {
        const chip = document.createElement("code");
        chip.className = "diff-chip";
        const f = ch.field || ch.Field || "field";
        const oldVal = ch.oldValue ?? ch.OldValue ?? "∅";
        const newVal = ch.newValue ?? ch.NewValue ?? "∅";
        chip.textContent = `${f}: ${oldVal} → ${newVal}`;
        diffWrap.appendChild(chip);
      }
      diffTd.appendChild(diffWrap);
      tr.appendChild(diffTd);

      const corrTd = document.createElement("td");
      const corrCode = document.createElement("code");
      corrCode.textContent = entry.correlationId ? entry.correlationId.slice(0, 16) : "—";
      if (entry.correlationId) {
        corrCode.title = entry.correlationId;
      }
      corrTd.appendChild(corrCode);
      tr.appendChild(corrTd);

      dom.changeAuditsTableBody.appendChild(tr);
    }
  }

  async function loadChangeAudits() {
    if (!dom.changeAuditsLoading) {
      return;
    }

    showMessage(dom.changeAuditsError, "");
    dom.changeAuditsLoading.hidden = false;

    try {
      const [custResp, ciamResp, iamResp] = await Promise.all([
        apiRequest("/customers/change-audits?limit=100"),
        apiRequest("/customer-accounts/change-audits?limit=100"),
        apiRequest("/admin-identity/change-audits?limit=100")
      ]);

      if (custResp.status === 401 || ciamResp.status === 401 || iamResp.status === 401) {
        redirectToLogin("expired");
        return;
      }

      const combined = [];
      if (custResp.ok && Array.isArray(custResp.data)) {
        for (const item of custResp.data) {
          combined.push(normalizeChangeEntry("customers", item));
        }
      }
      if (ciamResp.ok && Array.isArray(ciamResp.data)) {
        for (const item of ciamResp.data) {
          combined.push(normalizeChangeEntry("customer-accounts", item));
        }
      }
      if (iamResp.ok && Array.isArray(iamResp.data)) {
        for (const item of iamResp.data) {
          combined.push(normalizeChangeEntry("admin-identity", item));
        }
      }

      combined.sort((a, b) => new Date(b.occurredAtUtc || 0).getTime() - new Date(a.occurredAtUtc || 0).getTime());
      state.changeAudits = combined;
      renderChangeAudits();
    } catch {
      showMessage(dom.changeAuditsError, "Network error while loading cross-service change audit trails.");
    } finally {
      dom.changeAuditsLoading.hidden = true;
    }
  }

  function renderOrderTags(container, section, orderIds) {
    container.replaceChildren();
    const orders = Array.isArray(orderIds) ? orderIds : [];
    if (orders.length === 0) {
      section.hidden = true;
      return;
    }

    for (const orderId of orders) {
      const chip = document.createElement("span");
      chip.className = "order-chip";
      chip.textContent = String(orderId);
      container.appendChild(chip);
    }

    section.hidden = false;
  }

  function normalizeCustomerDetails(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    return {
      id: String(raw.id || raw.Id || ""),
      email: String(raw.email || raw.Email || ""),
      fullName: String(raw.fullName || raw.FullName || ""),
      address: String(raw.address || raw.Address || ""),
      state: String(raw.state || raw.State || "incomplete").toLowerCase(),
      isVip: Boolean(raw.isVip ?? raw.IsVip),
      createdAt: raw.createdAt || raw.CreatedAt || null,
      completedOrders: Array.isArray(raw.completedOrders || raw.CompletedOrders)
        ? (raw.completedOrders || raw.CompletedOrders)
        : []
    };
  }

  function populateModalCiamSupport(ciamData) {
    if (!dom.modalAccountSupport) {
      return;
    }

    if (!ciamData || typeof ciamData !== "object") {
      dom.modalAccountSupport.hidden = true;
      return;
    }

    state.selectedCustomerCiam = ciamData;
    dom.modalAccountSupport.hidden = false;

    const email = String(ciamData.email || ciamData.Email || "");
    const failedCount = Number(ciamData.failedLoginCount ?? ciamData.FailedLoginCount ?? 0);
    const lockedUntil = ciamData.lockedOutUntilUtc || ciamData.LockedOutUntilUtc || null;
    const isLocked = Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());

    dom.modalCiamStatus.textContent = isLocked
      ? `Sign-in LOCKED until ${formatDateTime(lockedUntil)} (${failedCount} failed attempts)`
      : `Sign-in active (${email}) · ${failedCount} failed attempts`;

    dom.modalUnlockLogin.hidden = !(canMutateCustomers() && (isLocked || failedCount > 0));
    dom.modalCiamEmailRow.hidden = !canMutateCustomers();
    dom.modalCiamEmailInput.value = email;
  }

  function renderModalCustomerAudits(entries) {
    if (!dom.modalCustomerAuditsSection || !dom.modalCustomerAuditsList) {
      return;
    }

    dom.modalCustomerAuditsList.replaceChildren();
    const items = Array.isArray(entries) ? entries.slice(0, 8) : [];
    if (!items.length) {
      dom.modalCustomerAuditsSection.hidden = true;
      return;
    }

    dom.modalCustomerAuditsSection.hidden = false;
    for (const raw of items) {
      const entry = normalizeChangeEntry("customers", raw);
      const row = document.createElement("div");
      row.className = "modal-audit-item";
      const summary = entry.changes
        .map(c => `${c.field || c.Field}: ${c.oldValue ?? c.OldValue ?? "∅"} → ${c.newValue ?? c.NewValue ?? "∅"}`)
        .join(", ");
      row.textContent = `${formatDateTime(entry.occurredAtUtc)} · ${entry.action} by ${entry.actorAuthority} (${entry.actorRole}) — ${summary}`;
      dom.modalCustomerAuditsList.appendChild(row);
    }
  }

  function populateModalCustomer(details) {
    const normalized = normalizeCustomerDetails(details);
    if (!normalized) {
      return;
    }

    state.selectedCustomer = normalized;
    dom.modalTitle.textContent = normalized.fullName.trim() || "Customer Details";
    dom.modalId.textContent = normalized.id;

    applyStatePill(dom.modalStatePill, normalized.state);
    dom.modalVipBadge.hidden = !normalized.isVip;
    dom.modalCreated.textContent = formatDateTime(normalized.createdAt);
    dom.modalOrdersCount.textContent = String(normalized.completedOrders.length);

    renderOrderTags(dom.modalOrdersList, dom.modalOrdersSection, normalized.completedOrders);

    dom.modalNameInput.value = normalized.fullName;
    dom.modalEmailInput.value = normalized.email;
    dom.modalAddressInput.value = normalized.address;

    const validStates = ["valid", "incomplete", "suspicious", "locked"];
    dom.modalStateSelect.value = validStates.includes(normalized.state) ? normalized.state : "valid";

    const editable = canMutateCustomers();
    dom.modalNameInput.disabled = !editable;
    dom.modalEmailInput.disabled = !editable;
    dom.modalAddressInput.disabled = !editable;
    dom.modalStateSelect.disabled = !editable;
    dom.modalSaveState.hidden = !editable;
    dom.modalResetEdit.hidden = !editable;
    dom.modalEditSubmit.hidden = !editable;
  }

  function resetModalEditForm() {
    if (!state.selectedCustomer) {
      return;
    }

    populateModalCustomer(state.selectedCustomer);
    showMessage(dom.modalMessage, "");
  }

  async function openCustomerModal(customerId) {
    if (!customerId) {
      return;
    }

    state.selectedCustomer = null;
    state.selectedCustomerCiam = null;
    dom.customerModal.hidden = false;
    dom.modalLoading.hidden = false;
    dom.modalContent.hidden = true;
    dom.modalTitle.textContent = "Customer Details";
    dom.modalId.textContent = customerId;
    showMessage(dom.modalMessage, "");

    try {
      const [response, ciamResp, auditsResp] = await Promise.all([
        apiRequest(`/customers/${encodeURIComponent(customerId)}`),
        apiRequest(`/customer-accounts/users/${encodeURIComponent(customerId)}`),
        apiRequest(`/customers/${encodeURIComponent(customerId)}/change-audits?limit=10`)
      ]);

      if (response.status === 401) {
        closeCustomerModal();
        redirectToLogin("expired");
        return;
      }

      if (!response.ok || !response.data) {
        dom.modalContent.hidden = false;
        showMessage(
          dom.modalMessage,
          friendlyApiError(response.status, response.data, "Unable to load customer details.")
        );
        return;
      }

      populateModalCustomer(response.data);
      populateModalCiamSupport(ciamResp.ok ? ciamResp.data : null);
      renderModalCustomerAudits(auditsResp.ok ? auditsResp.data : []);
      dom.modalContent.hidden = false;
      if (canMutateCustomers()) {
        dom.modalNameInput.focus();
      }
    } catch {
      dom.modalContent.hidden = false;
      showMessage(dom.modalMessage, "Network error while loading customer details.");
    } finally {
      dom.modalLoading.hidden = true;
    }
  }

  async function handleUnlockCustomerLogin() {
    if (!state.selectedCustomer?.id || !canMutateCustomers()) {
      return;
    }

    const customerId = state.selectedCustomer.id;
    setModalBusy(true);
    try {
      const response = await apiRequest(`/customer-accounts/users/${encodeURIComponent(customerId)}/unlock`, {
        method: "POST"
      });
      if (!response.ok) {
        showMessage(dom.modalMessage, friendlyApiError(response.status, response.data, "Could not unlock customer sign-in."));
        return;
      }
      const ciamResp = await apiRequest(`/customer-accounts/users/${encodeURIComponent(customerId)}`);
      populateModalCiamSupport(ciamResp.ok ? ciamResp.data : null);
      showMessage(dom.modalMessage, "Customer sign-in unlocked in identitydb.", "success");
      showToast("Customer login unlocked.");
    } catch {
      showMessage(dom.modalMessage, "Network error while unlocking customer sign-in.");
    } finally {
      setModalBusy(false);
    }
  }

  async function handleUpdateCustomerCiamEmail() {
    if (!state.selectedCustomer?.id || !canMutateCustomers()) {
      return;
    }

    const customerId = state.selectedCustomer.id;
    const newEmail = dom.modalCiamEmailInput.value.trim();
    if (!newEmail || !newEmail.includes("@")) {
      showMessage(dom.modalMessage, "Please enter a valid sign-in email address.");
      return;
    }

    setModalBusy(true);
    try {
      const response = await apiRequest(`/customer-accounts/users/${encodeURIComponent(customerId)}/email`, {
        method: "PUT",
        body: { newEmail }
      });
      if (!response.ok) {
        showMessage(dom.modalMessage, friendlyApiError(response.status, response.data, "Could not update customer sign-in email."));
        return;
      }
      populateModalCiamSupport(response.data);
      dom.modalEmailInput.value = newEmail;
      showMessage(dom.modalMessage, "Sign-in email updated in identitydb and queued for profile sync.", "success");
      showToast("Customer sign-in email updated.");
      await loadDirectory({ silent: true });
    } catch {
      showMessage(dom.modalMessage, "Network error while updating customer sign-in email.");
    } finally {
      setModalBusy(false);
    }
  }

  function closeCustomerModal() {
    dom.customerModal.hidden = true;
    state.selectedCustomer = null;
    state.selectedCustomerCiam = null;
    showMessage(dom.modalMessage, "");
  }

  function setModalBusy(busy) {
    dom.modalEditSubmit.disabled = busy;
    dom.modalSaveState.disabled = busy;
    dom.modalResetEdit.disabled = busy;
    if (dom.modalUnlockLogin) {
      dom.modalUnlockLogin.disabled = busy;
    }
    if (dom.modalSaveCiamEmail) {
      dom.modalSaveCiamEmail.disabled = busy;
    }
  }

  async function submitCustomerEdit(event) {
    event.preventDefault();
    if (!state.selectedCustomer?.id || !canMutateCustomers()) {
      return;
    }

    const customerId = state.selectedCustomer.id;
    const fullName = dom.modalNameInput.value.trim();
    const email = dom.modalEmailInput.value.trim();
    const address = dom.modalAddressInput.value.trim();
    const nextState = dom.modalStateSelect.value.trim().toLowerCase();

    if (!fullName) {
      showMessage(dom.modalMessage, "Full name is required.");
      dom.modalNameInput.focus();
      return;
    }
    if (fullName.length > 200) {
      showMessage(dom.modalMessage, "Full name must be 200 characters or fewer.");
      dom.modalNameInput.focus();
      return;
    }
    if (!address) {
      showMessage(dom.modalMessage, "Address is required.");
      dom.modalAddressInput.focus();
      return;
    }
    if (address.length > 500) {
      showMessage(dom.modalMessage, "Address must be 500 characters or fewer.");
      dom.modalAddressInput.focus();
      return;
    }
    if (email && (!email.includes("@") || email.length > 320)) {
      showMessage(dom.modalMessage, "Please enter a valid email address (up to 320 characters).");
      dom.modalEmailInput.focus();
      return;
    }

    setModalBusy(true);
    showMessage(dom.modalMessage, "");

    try {
      const payload = {
        customerId,
        fullName,
        address,
        email: email || null,
        state: nextState || null
      };

      const response = await apiRequest(`/customers/${encodeURIComponent(customerId)}`, {
        method: "PUT",
        body: payload
      });

      if (response.status === 401) {
        closeCustomerModal();
        redirectToLogin("expired");
        return;
      }

      if (!response.ok) {
        showMessage(
          dom.modalMessage,
          friendlyApiError(response.status, response.data, "Unable to save customer changes.")
        );
        return;
      }

      if (response.data) {
        populateModalCustomer(response.data);
      }

      const auditsResp = await apiRequest(`/customers/${encodeURIComponent(customerId)}/change-audits?limit=10`);
      if (auditsResp.ok) {
        renderModalCustomerAudits(auditsResp.data);
      }

      showMessage(dom.modalMessage, "Customer record updated.", "success");
      showToast("Customer changes saved.");
      await loadDirectory({ silent: true });
    } catch {
      showMessage(dom.modalMessage, "Network error while saving customer changes.");
    } finally {
      setModalBusy(false);
    }
  }

  async function submitModalStateOnly() {
    if (!state.selectedCustomer?.id || !canMutateCustomers()) {
      return;
    }

    const customerId = state.selectedCustomer.id;
    const targetState = dom.modalStateSelect.value.trim().toLowerCase();
    if (!targetState) {
      return;
    }

    setModalBusy(true);
    showMessage(dom.modalMessage, "");

    try {
      const response = await apiRequest(
        `/customers/${encodeURIComponent(customerId)}/state/${encodeURIComponent(targetState)}`,
        { method: "PUT" }
      );

      if (response.status === 401) {
        closeCustomerModal();
        redirectToLogin("expired");
        return;
      }

      if (!response.ok) {
        showMessage(
          dom.modalMessage,
          friendlyApiError(response.status, response.data, "Could not update customer state.")
        );
        return;
      }

      const [refreshed, auditsResp] = await Promise.all([
        apiRequest(`/customers/${encodeURIComponent(customerId)}`),
        apiRequest(`/customers/${encodeURIComponent(customerId)}/change-audits?limit=10`)
      ]);
      if (refreshed.ok && refreshed.data) {
        populateModalCustomer(refreshed.data);
      }
      if (auditsResp.ok) {
        renderModalCustomerAudits(auditsResp.data);
      }

      showMessage(dom.modalMessage, `Lifecycle state updated to ${targetState}.`, "success");
      showToast("Customer state updated.");
      await loadDirectory({ silent: true });
    } catch {
      showMessage(dom.modalMessage, "Network error while updating customer state.");
    } finally {
      setModalBusy(false);
    }
  }

  async function copyModalCustomerId() {
    const idText = state.selectedCustomer?.id || dom.modalId.textContent || "";
    if (!idText || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(idText);
      showToast("Customer ID copied to clipboard.");
    } catch {
      // Clipboard API may be blocked in restricted browser contexts.
    }
  }

  async function handleSignOut() {
    closeCustomerModal();

    await fetch("/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE
      }
    }).catch(() => null);

    redirectToLogin("signed-out");
  }

  async function bootstrapAdminSession() {
    try {
      const me = await apiRequest("/admin-identity/me");
      const role = String(me.data?.role || me.data?.Role || "").toLowerCase();
      if (!me.ok || !me.data || !WORKFORCE_ROLES.has(role)) {
        redirectToLogin("expired");
        return;
      }

      state.adminId = me.data.id || me.data.Id || null;
      state.email = me.data.email || me.data.Email || "Employee";
      state.role = role;
      updateIdentityHeader();

      const initialPath = window.location.pathname.toLowerCase();
      if (initialPath === "/admins") {
        switchView("admins");
        await loadAdmins();
      } else if (initialPath === "/audits") {
        switchView("audits");
        await loadChangeAudits();
      } else {
        await loadDirectory();
      }
    } catch {
      showMessage(dom.directoryError, "Unable to verify workforce session through the API Gateway.");
    }
  }

  function wireEvents() {
    if (dom.footerYear) {
      dom.footerYear.textContent = String(new Date().getFullYear());
    }

    dom.navDirectory.addEventListener("click", () => {
      switchView("directory");
      loadDirectory();
    });

    dom.navAdmins.addEventListener("click", () => {
      switchView("admins");
      loadAdmins();
    });

    if (dom.navAudits) {
      dom.navAudits.addEventListener("click", () => {
        switchView("audits");
        loadChangeAudits();
      });
    }

    dom.refreshWorkspace.addEventListener("click", () => {
      if (state.activeView === "admins") {
        loadAdmins();
      } else if (state.activeView === "audits") {
        loadChangeAudits();
      } else {
        loadDirectory();
      }
    });

    dom.directoryRefresh.addEventListener("click", () => loadDirectory());
    dom.adminsRefresh.addEventListener("click", () => loadAdmins());
    if (dom.auditsRefresh) {
      dom.auditsRefresh.addEventListener("click", () => loadChangeAudits());
    }
    dom.createAdminForm.addEventListener("submit", handleCreateAdmin);
    if (dom.selfPasswordForm) {
      dom.selfPasswordForm.addEventListener("submit", handleSelfPasswordChange);
    }
    if (dom.adminAuditOutcomeFilter) {
      dom.adminAuditOutcomeFilter.addEventListener("change", event => {
        state.adminAuditOutcomeFilter = event.target.value || "all";
        renderAdminAuditRows();
      });
    }
    if (dom.changeAuditsSourceFilter) {
      dom.changeAuditsSourceFilter.addEventListener("change", event => {
        state.changeAuditSourceFilter = event.target.value || "all";
        renderChangeAudits();
      });
    }
    if (dom.changeAuditsSearch) {
      dom.changeAuditsSearch.addEventListener("input", event => {
        state.changeAuditSearch = event.target.value || "";
        renderChangeAudits();
      });
    }

    dom.directorySearch.addEventListener("input", scheduleDirectorySearch);
    dom.directorySearch.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (state.directorySearchTimer) {
          clearTimeout(state.directorySearchTimer);
        }
        loadDirectory();
      }
    });
    dom.directoryStateFilter.addEventListener("change", () => loadDirectory());
    dom.directoryVipFilter.addEventListener("change", () => loadDirectory());
    dom.directoryClearFilters.addEventListener("click", clearDirectoryFilters);

    dom.logoutButton.addEventListener("click", handleSignOut);

    dom.modalEditForm.addEventListener("submit", submitCustomerEdit);
    dom.modalSaveState.addEventListener("click", submitModalStateOnly);
    if (dom.modalUnlockLogin) {
      dom.modalUnlockLogin.addEventListener("click", handleUnlockCustomerLogin);
    }
    if (dom.modalSaveCiamEmail) {
      dom.modalSaveCiamEmail.addEventListener("click", handleUpdateCustomerCiamEmail);
    }
    dom.modalResetEdit.addEventListener("click", resetModalEditForm);
    dom.modalCopyId.addEventListener("click", copyModalCustomerId);
    dom.modalClose.addEventListener("click", closeCustomerModal);
    dom.modalDone.addEventListener("click", closeCustomerModal);
    dom.modalBackdrop.addEventListener("click", closeCustomerModal);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !dom.customerModal.hidden) {
        closeCustomerModal();
      }
    });
  }

  wireEvents();
  bootstrapAdminSession();
})();
