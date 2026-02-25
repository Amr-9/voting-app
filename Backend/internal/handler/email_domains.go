package handler

import (
	"fmt"
	"regexp"
	"strings"
)

// domainLabelRe validates a single DNS label: starts and ends with alphanumeric,
// may contain hyphens in the middle. Lowercase only (caller must normalise first).
var domainLabelRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9\-]*[a-z0-9])?$`)

// validateDomain returns an error message if domain is not a valid host domain.
// The domain must already be lowercased and trimmed before calling.
// Returns an empty string when the domain is valid.
func validateDomain(domain string) string {
	if len(domain) == 0 || len(domain) > 253 {
		return "domain must be between 1 and 253 characters"
	}
	if strings.Contains(domain, "@") {
		return "domain must not contain '@'; provide only the domain part (e.g. myuniversity.edu.eg)"
	}
	if strings.HasPrefix(domain, ".") || strings.HasSuffix(domain, ".") {
		return "domain must not start or end with a dot"
	}
	if !strings.Contains(domain, ".") {
		return "domain must contain at least one dot (e.g. example.com)"
	}
	labels := strings.Split(domain, ".")
	for _, label := range labels {
		if label == "" {
			return "domain contains consecutive dots"
		}
		if !domainLabelRe.MatchString(label) {
			return fmt.Sprintf("domain label %q contains invalid characters (only a-z, 0-9, and hyphens allowed)", label)
		}
	}
	return ""
}

// allowedEmailDomains is the set of permitted email provider domains.
// Any email whose domain is not in this set will be rejected at OTP request time.
var allowedEmailDomains = map[string]struct{}{
	"gmail.com":       {},
	"outlook.com":     {},
	"hotmail.com":     {},
	"yahoo.com":       {},
	"icloud.com":      {},
	"me.com":          {},
	"msn.com":         {},
	"aol.com":         {},
	"proton.me":       {},
	"zoho.com":        {},
	"ymail.com":       {},
	"rocketmail.com":  {},
	"protonmail.com":  {},
	"mail.ru":         {},
	"yandex.com":      {},
	"yandex.ru":       {},
	"list.ru":         {},
	"bk.ru":           {},
	"inbox.ru":        {},
	"gmx.com":         {},
	"gmx.net":         {},
	"web.de":          {},
	"freenet.de":      {},
	"t-online.de":     {},
	"orange.fr":       {},
	"wanadoo.fr":      {},
	"free.fr":         {},
	"sfr.fr":          {},
	"laposte.net":     {},
	"libero.it":       {},
	"virgilio.it":     {},
	"tiscali.it":      {},
	"alice.it":        {},
	"uol.com.br":      {},
	"bol.com.br":      {},
	"terra.com.br":    {},
	"ig.com.br":       {},
	"globo.com":       {},
	"rediffmail.com":  {},
	"indiatimes.com":  {},
	"qq.com":          {},
	"163.com":         {},
	"126.com":         {},
	"sina.com":        {},
	"sohu.com":        {},
	"naver.com":       {},
	"daum.net":        {},
	"hanmail.net":     {},
	"comcast.net":     {},
	"verizon.net":     {},
	"att.net":         {},
	"sbcglobal.net":   {},
	"bellsouth.net":   {},
	"charter.net":     {},
	"cox.net":         {},
	"earthlink.net":   {},
	"optonline.net":   {},
	"shaw.ca":         {},
	"rogers.com":      {},
	"bell.net":        {},
	"sympatico.ca":    {},
	"sky.com":         {},
	"virginmedia.com": {},
	"telstra.com":     {},
	"bigpond.com":     {},
	"tuta.io":         {},
	"tuta.com":        {},
	"mailfence.com":   {},
	"hushmail.com":    {},
	"runbox.com":      {},
	"yahoo.co.uk":     {},
	"outlook.sa":      {},
	"outlook.fr":      {},
	"hotmail.co.uk":   {},
	"yahoo.ca":        {},
	"live.com":        {},
	"live.co.uk":      {},
	"live.fr":         {},
	"outlook.de":      {},
	"outlook.com.br":  {},
	"yahoo.de":        {},
	"yahoo.in":        {},
	"yahoo.com.br":    {},
	"yahoo.com.ar":    {},
	"pm.me":           {},
	"googlemail.com":  {}, // historical Gmail alias (Germany, UK); treated as gmail.com
}

// isEmailDomainAllowed returns true if the email's domain is in the allowlist.
func isEmailDomainAllowed(email string) bool {
	at := strings.LastIndex(email, "@")
	if at < 0 {
		return false
	}
	domain := strings.ToLower(email[at+1:])
	_, ok := allowedEmailDomains[domain]
	return ok
}

// normalizeEmail canonicalizes an email address to prevent duplicate-vote tricks:
//
//   - Lowercases the entire address.
//   - For all providers: strips the plus-suffix from the local part
//     (e.g. amr+test@outlook.com → amr@outlook.com).
//   - For Gmail / Googlemail only: also removes dots from the local part
//     (e.g. a.m.r@gmail.com → amr@gmail.com) and normalizes googlemail.com → gmail.com.
//     Both rules mirror Gmail's own identity-equivalence behaviour.
//
// The result is stored in the DB and used as the Redis OTP key, so both
// RequestOTP and VerifyVote must normalize before any lookup or insert.
func normalizeEmail(email string) string {
	email = strings.ToLower(email)

	at := strings.LastIndex(email, "@")
	if at < 0 {
		return email // malformed — let the binding validator catch it
	}
	local, domain := email[:at], email[at+1:]

	// Strip plus-suffix for all providers
	if plus := strings.Index(local, "+"); plus >= 0 {
		local = local[:plus]
	}

	// Gmail-specific: remove dots and canonicalize googlemail.com → gmail.com
	if domain == "gmail.com" || domain == "googlemail.com" {
		local = strings.ReplaceAll(local, ".", "")
		domain = "gmail.com"
	}

	return local + "@" + domain
}
