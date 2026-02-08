"""
HTML email templates for OMNIA notifications via Resend.

Each function returns (subject, html_body) ready for Django's send_mail.
"""

# ─── Base layout ─────────────────────────────────────────────

_BASE = """
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:#1B5E20;padding:24px 32px;text-align:center;">
    <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px;">OMNIA</span>
    <br><span style="color:#A5D6A7;font-size:12px;">{subtitle}</span>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:32px;">
    {content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
    <span style="color:#9ca3af;font-size:11px;">OMNIA Charity Tracking &bull; Ne pas répondre à cet email</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>
""".strip()


def _render(subtitle: str, content: str) -> str:
    return _BASE.format(subtitle=subtitle, content=content)


# ─── Visit Report ────────────────────────────────────────────

def visit_report(
    family_name: str,
    agent_name: str,
    visit_date: str,
    aids: list[dict],
    is_urgent: bool = False,
    notes: str = "",
) -> tuple[str, str]:
    """Email sent after a visit is completed."""
    subject = f"Rapport de visite — Famille {family_name}"

    aids_rows = ""
    for a in aids:
        aids_rows += f'<tr><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">{a.get("label", "")}</td><td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:center;">{a.get("qty", 1)}</td></tr>'

    urgent_badge = (
        '<span style="display:inline-block;background:#D32F2F;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px;">URGENT</span>'
        if is_urgent else ""
    )

    notes_section = ""
    if notes:
        notes_section = f'<p style="margin:16px 0 0;padding:12px;background:#f9fafb;border-radius:8px;color:#374151;font-size:14px;">{notes}</p>'

    content = f"""
    <h2 style="margin:0 0 4px;color:#1a1d21;font-size:18px;">Visite effectuée {urgent_badge}</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">{visit_date} — par {agent_name}</p>

    <p style="margin:0 0 8px;color:#374151;font-size:15px;font-weight:600;">Famille : {family_name}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background:#f3f4f6;">
        <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Aide distribuée</th>
        <th style="padding:10px 12px;text-align:center;font-size:13px;color:#6b7280;">Qté</th>
      </tr>
      {aids_rows}
    </table>
    {notes_section}
    """

    return subject, _render("Suivi des visites", content)


# ─── Overdue Reminder ────────────────────────────────────────

def overdue_reminder(
    family_name: str,
    agent_name: str,
    days_overdue: int,
    due_date: str,
) -> tuple[str, str]:
    """Reminder email for overdue family visits."""
    subject = f"⚠ Visite en retard — Famille {family_name} ({days_overdue}j)"

    content = f"""
    <h2 style="margin:0 0 4px;color:#D32F2F;font-size:18px;">⚠ Visite en retard</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Rappel automatique</p>

    <div style="background:#FFF3E0;border-left:4px solid #F57C00;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="margin:0;color:#E65100;font-size:14px;font-weight:600;">
        La famille <strong>{family_name}</strong> a une visite en retard de <strong>{days_overdue} jour(s)</strong>.
      </p>
      <p style="margin:8px 0 0;color:#795548;font-size:13px;">Échéance prévue : {due_date}</p>
    </div>

    <p style="margin:16px 0 0;color:#374151;font-size:14px;">
      Agent assigné : <strong>{agent_name}</strong>
    </p>
    <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">
      Connectez-vous à OMNIA pour planifier la visite.
    </p>
    """

    return subject, _render("Rappel de visite", content)


# ─── Complaint Update ────────────────────────────────────────

def complaint_update(
    family_name: str,
    complaint_id: str,
    new_status: str,
    message: str = "",
) -> tuple[str, str]:
    """Email sent when a complaint status changes."""
    status_labels = {
        "open": ("Ouverte", "#1976D2"),
        "in_progress": ("En cours", "#F57C00"),
        "resolved": ("Résolue", "#388E3C"),
        "closed": ("Fermée", "#757575"),
    }
    label, color = status_labels.get(new_status, (new_status, "#757575"))
    subject = f"Plainte mise à jour — Famille {family_name}"

    msg_section = ""
    if message:
        msg_section = f'<div style="margin:16px 0;padding:12px;background:#f9fafb;border-radius:8px;border-left:3px solid #e5e7eb;"><p style="margin:0;color:#374151;font-size:14px;">{message}</p></div>'

    content = f"""
    <h2 style="margin:0 0 4px;color:#1a1d21;font-size:18px;">Mise à jour de plainte</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Famille {family_name} — #{complaint_id[:8]}</p>

    <div style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;background:{color};color:#fff;padding:6px 20px;border-radius:20px;font-size:14px;font-weight:600;">{label}</span>
    </div>
    {msg_section}
    """

    return subject, _render("Suivi des plaintes", content)


# ─── Welcome Email ───────────────────────────────────────────

def welcome(
    first_name: str,
    email: str,
    role: str = "agent",
) -> tuple[str, str]:
    """Welcome email for new users."""
    subject = f"Bienvenue sur OMNIA, {first_name} !"
    role_label = "Administrateur" if role == "admin" else "Agent de terrain"

    content = f"""
    <h2 style="margin:0 0 4px;color:#1a1d21;font-size:18px;">Bienvenue sur OMNIA 🎉</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Plateforme de suivi caritatif</p>

    <p style="margin:0 0 12px;color:#374151;font-size:15px;">
      Bonjour <strong>{first_name}</strong>,
    </p>
    <p style="margin:0 0 12px;color:#374151;font-size:14px;">
      Votre compte a été créé avec succès.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#f9fafb;border-radius:8px;padding:16px;">
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Email</td>
        <td style="padding:8px 16px;color:#1a1d21;font-size:14px;font-weight:500;">{email}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;color:#6b7280;font-size:13px;">Rôle</td>
        <td style="padding:8px 16px;color:#1a1d21;font-size:14px;font-weight:500;">{role_label}</td>
      </tr>
    </table>

    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
      Connectez-vous pour commencer à utiliser la plateforme.
    </p>
    """

    return subject, _render("Bienvenue", content)


# ─── Emergency Alert ─────────────────────────────────────────

def emergency_alert(
    emergency_type: str,
    triggered_by: str,
    summary: str = "",
    location: str = "",
) -> tuple[str, str]:
    """Email sent when an emergency is triggered."""
    subject = f"🚨 URGENCE — {emergency_type}"

    loc_section = ""
    if location:
        loc_section = f'<p style="margin:8px 0 0;color:#795548;font-size:13px;">📍 {location}</p>'

    content = f"""
    <h2 style="margin:0 0 4px;color:#D32F2F;font-size:18px;">🚨 Alerte d'urgence</h2>
    <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">Action immédiate requise</p>

    <div style="background:#FFEBEE;border-left:4px solid #D32F2F;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
      <p style="margin:0;color:#B71C1C;font-size:15px;font-weight:600;">{emergency_type}</p>
      <p style="margin:8px 0 0;color:#C62828;font-size:14px;">Déclenché par : {triggered_by}</p>
      {loc_section}
    </div>

    {f'<p style="margin:16px 0 0;color:#374151;font-size:14px;">{summary}</p>' if summary else ''}

    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
      Connectez-vous à OMNIA pour gérer cette urgence.
    </p>
    """

    return subject, _render("Alerte d'urgence", content)
