(() => {
  "use strict";

  const CSRF_HEADER_NAME = "X-Requested-With";
  const CSRF_HEADER_VALUE = "DavidsAdmin";

  const state = {
    adminId: null,
    email: null,
    role: null,
    activeView: "directory",
    directory: [],
    admins: [],
    adminAudits: [],
    adminAuditOutcomeFilter: "all",
    selectedCustomer: null,
    directorySearchTimer: null,
    directoryRequestId: 0,
    toastTimer: null
  };

  const el = id => document.getElementById(id);

  const dom = {
    workspace: el("workspace"),
    navDirectory: el("nav-directory"),
    navAdmins: el("nav-admins"),
    breadcrumbTitle: el("breadcrumb-title"),
    refreshWorkspace: el("refresh-workspace"),
    userAvatar: el("user-avatar"),
    userName: el("user-name"),
    userRole: el("user-role"),
    logoutButton: el("logout-button"),
    toast: el("toast"),
    footerYear: el("footer-year"),

    directoryView: el("directory-view"),
    directoryRefresh: el("directory-refresh"),
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
    createAdminForm: el("create-admin-form"),
    newAdminEmail: el("new-admin-email"),
    newAdminPassword: el("new-admin-password"),
    createAdminMessage: el("create-admin-message"),
    createAdminSubmit: el("create-admin-submit"),
    adminAuditCount: el("admin-audit-count"),
    adminAuditOutcomeFilter: el("admin-audit-outcome-filter"),
    adminAuditsTableBody: el("admin-audits-tbody"),

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
    modalEditForm: el("modal-edit-form"),
    modalNameInput: el("modal-name-input"),
    modalEmailInput: el("modal-email-input"),
    modalAddressInput: el("modal-address-input"),
    modalStateSelect: el("modal-state-select"),
    modalSaveState: el("modal-save-state"),
    modalMessage: el("modal-message"),
    modalResetEdit: el("modal-reset-edit"),
    modalEditSubmit: el("modal-edit-submit"),
    modalDone: el("modal-done")
  };

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
      return "An administrator account with that email address already exists.";
    }
    if (code === "customer_email_in_use" || status === 409) {
      return reason || "Another customer record already uses that email address.";
    }
    if (code === "invalid_customer_email" || code === "invalid_email") {
      return reason || "Please enter a valid email address.";
    }
    if (code === "invalid_password") {
      return reason || "Password must be at least 12 characters.";
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
      return "Your administrator session expired. Please sign in again.";
    }
    if (status === 403) {
      return "Administrator permissions are required for this action.";
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

    // Davids.APIGateway automatically refreshes near-expiry OIDC tokens inside the encrypted HttpOnly BFF cookie.
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
    const label = state.email || "Administrator";
    dom.userName.textContent = label;
    dom.userRole.textContent = "Administrator";
    dom.userAvatar.textContent = label.trim().charAt(0).toUpperCase() || "A";

    if (dom.adminSelfEmail) {
      dom.adminSelfEmail.textContent = label;
    }
    if (dom.adminSelfId) {
      dom.adminSelfId.textContent = state.adminId ? `ID ${state.adminId}` : "Verified AdminBearer session";
    }
  }

  function switchView(view) {
    const target = view === "admins" ? "admins" : "directory";
    state.activeView = target;

    const showingDirectory = target === "directory";
    dom.directoryView.hidden = !showingDirectory;
    dom.adminsView.hidden = showingDirectory;

    dom.navDirectory.classList.toggle("active", showingDirectory);
    dom.navAdmins.classList.toggle("active", !showingDirectory);
    dom.breadcrumbTitle.textContent = showingDirectory ? "Customer Directory" : "Administrator Accounts";
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
      editBtn.textContent = "Edit customer";
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

      if (response.status === 401 || response.status === 403) {
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

  function renderAdminRows(admins) {
    dom.adminsTableBody.replaceChildren();
    const items = Array.isArray(admins) ? admins : [];
    dom.adminsTotalCount.textContent = String(items.length);

    for (const item of items) {
      const id = String(item.id || item.Id || "");
      const email = String(item.email || item.Email || "");
      const role = String(item.role || item.Role || "admin");
      const createdAt = item.createdAt || item.CreatedAt;

      const tr = document.createElement("tr");

      const emailTd = document.createElement("td");
      const wrap = document.createElement("div");
      wrap.className = "customer-primary-cell";
      const strong = document.createElement("strong");
      strong.textContent = email;
      wrap.appendChild(strong);
      const idMeta = document.createElement("span");
      idMeta.className = "customer-id-meta";
      idMeta.textContent = id;
      wrap.appendChild(idMeta);
      emailTd.appendChild(wrap);
      tr.appendChild(emailTd);

      const roleTd = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = "state-pill state-valid";
      pill.textContent = role;
      roleTd.appendChild(pill);
      tr.appendChild(roleTd);

      const createdTd = document.createElement("td");
      createdTd.textContent = formatDateTime(createdAt);
      tr.appendChild(createdTd);

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
      if (response.status === 401 || response.status === 403) {
        redirectToLogin("expired");
        return;
      }

      if (!response.ok) {
        showMessage(
          dom.adminsError,
          friendlyApiError(response.status, response.data, "Could not load administrator accounts.")
        );
        return;
      }

      state.admins = Array.isArray(response.data) ? response.data : [];
      state.adminAudits = auditsResponse.ok && Array.isArray(auditsResponse.data) ? auditsResponse.data : [];
      renderAdminRows(state.admins);
      renderAdminAuditRows();
      dom.adminsTableWrap.hidden = false;
    } catch {
      showMessage(dom.adminsError, "Network error while loading administrator accounts.");
    } finally {
      dom.adminsLoading.hidden = true;
    }
  }

  async function handleCreateAdmin(event) {
    event.preventDefault();
    const email = dom.newAdminEmail.value.trim();
    const password = dom.newAdminPassword.value;

    if (!email || !email.includes("@")) {
      showMessage(dom.createAdminMessage, "Please enter a valid administrator email address.");
      return;
    }
    if (!password || password.length < 12) {
      showMessage(dom.createAdminMessage, "Administrator password must be at least 12 characters.");
      return;
    }

    dom.createAdminSubmit.disabled = true;
    showMessage(dom.createAdminMessage, "");

    try {
      const response = await apiRequest("/admin-identity/users", {
        method: "POST",
        body: { email, password }
      });

      if (response.status === 401 || response.status === 403) {
        redirectToLogin("expired");
        return;
      }

      if (!response.ok) {
        showMessage(
          dom.createAdminMessage,
          friendlyApiError(response.status, response.data, "Could not provision administrator account.")
        );
        return;
      }

      dom.newAdminEmail.value = "";
      dom.newAdminPassword.value = "";
      showMessage(dom.createAdminMessage, "Administrator account provisioned.", "success");
      showToast("Administrator provisioned in adminidentitydb.");
      await loadAdmins();
    } catch {
      showMessage(dom.createAdminMessage, "Network error while provisioning administrator account.");
    } finally {
      dom.createAdminSubmit.disabled = false;
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
    dom.customerModal.hidden = false;
    dom.modalLoading.hidden = false;
    dom.modalContent.hidden = true;
    dom.modalTitle.textContent = "Customer Details";
    dom.modalId.textContent = customerId;
    showMessage(dom.modalMessage, "");

    try {
      const response = await apiRequest(`/customers/${encodeURIComponent(customerId)}`);
      if (response.status === 401 || response.status === 403) {
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
      dom.modalContent.hidden = false;
      dom.modalNameInput.focus();
    } catch {
      dom.modalContent.hidden = false;
      showMessage(dom.modalMessage, "Network error while loading customer details.");
    } finally {
      dom.modalLoading.hidden = true;
    }
  }

  function closeCustomerModal() {
    dom.customerModal.hidden = true;
    state.selectedCustomer = null;
    showMessage(dom.modalMessage, "");
  }

  function setModalBusy(busy) {
    dom.modalEditSubmit.disabled = busy;
    dom.modalSaveState.disabled = busy;
    dom.modalResetEdit.disabled = busy;
  }

  async function submitCustomerEdit(event) {
    event.preventDefault();
    if (!state.selectedCustomer?.id) {
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

      if (response.status === 401 || response.status === 403) {
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
      } else {
        const refreshed = await apiRequest(`/customers/${encodeURIComponent(customerId)}`);
        if (refreshed.ok && refreshed.data) {
          populateModalCustomer(refreshed.data);
        }
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
    if (!state.selectedCustomer?.id) {
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

      if (response.status === 401 || response.status === 403) {
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

      const refreshed = await apiRequest(`/customers/${encodeURIComponent(customerId)}`);
      if (refreshed.ok && refreshed.data) {
        populateModalCustomer(refreshed.data);
      } else {
        state.selectedCustomer.state = targetState;
        populateModalCustomer(state.selectedCustomer);
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
      if (!me.ok || !me.data || String(me.data.role || "").toLowerCase() !== "admin") {
        redirectToLogin("expired");
        return;
      }

      state.adminId = me.data.id || me.data.Id || null;
      state.email = me.data.email || me.data.Email || "Administrator";
      state.role = "admin";
      updateIdentityHeader();
      await loadDirectory();
    } catch {
      showMessage(dom.directoryError, "Unable to verify administrator session through the API Gateway.");
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

    dom.refreshWorkspace.addEventListener("click", () => {
      if (state.activeView === "admins") {
        loadAdmins();
      } else {
        loadDirectory();
      }
    });

    dom.directoryRefresh.addEventListener("click", () => loadDirectory());
    dom.adminsRefresh.addEventListener("click", () => loadAdmins());
    dom.createAdminForm.addEventListener("submit", handleCreateAdmin);
    if (dom.adminAuditOutcomeFilter) {
      dom.adminAuditOutcomeFilter.addEventListener("change", event => {
        state.adminAuditOutcomeFilter = event.target.value || "all";
        renderAdminAuditRows();
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
