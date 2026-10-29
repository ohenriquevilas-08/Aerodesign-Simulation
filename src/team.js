(() => {
  const game = globalThis.AeroDesign ||= {};
  const { teamRoles, teamAssignments, teamCandidates, teamCapacityForReputation } = game.Content;
  const areas = new Set(teamRoles);
  const assignments = new Set(teamAssignments.map(({ id }) => id));
  const specialties = new Set(teamCandidates.map(({ specialty }) => specialty));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function makeMember({
    id, label, role, specialty, assignment, experience, motivation, joinYear, leaveYear = null,
    captainArea = null, captainSince = null
  }) {
    return {
      id, label, role, specialty, assignment, experience, motivation, joinYear, leaveYear,
      captainArea, captainSince
    };
  }

  function candidateOffers(year) {
    return teamCandidates.map((candidate) => ({
      id: `candidate-${year}-${candidate.specialty}`,
      label: `Integrante · ${candidate.label}`,
      specialty: candidate.specialty,
      cost: candidate.cost,
      reputationRequired: candidate.reputationRequired,
      experience: candidate.experience
    }));
  }

  function create(year = 1) {
    const members = [
      makeMember({
        id: "president",
        label: "Presidência",
        role: "president",
        specialty: "management",
        assignment: "mentoring",
        experience: 1,
        motivation: 85,
        joinYear: 1
      })
    ];
    if (year <= 2) {
      members.push(
        makeMember({
          id: "founder-aerodynamics",
          label: "Capitão fundador A",
          role: "founder-captain",
          specialty: "aerodynamics",
          assignment: "aerodynamics",
          experience: 1,
          motivation: 82,
          joinYear: 1,
          leaveYear: 3,
          captainArea: "aerodynamics",
          captainSince: 1
        }),
        makeMember({
          id: "founder-structures",
          label: "Capitão fundador B",
          role: "founder-captain",
          specialty: "structures",
          assignment: "structures",
          experience: 1,
          motivation: 82,
          joinYear: 1,
          leaveYear: 3,
          captainArea: "structures",
          captainSince: 1
        })
      );
    } else {
      members.push(
        makeMember({
          id: `legacy-captain-aerodynamics-${year}`,
          label: "Capitão · Aerodinâmica",
          role: "captain",
          specialty: "aerodynamics",
          assignment: "aerodynamics",
          experience: 1.5,
          motivation: 75,
          joinYear: Math.max(1, year - 1),
          leaveYear: year + 2,
          captainArea: "aerodynamics",
          captainSince: year
        }),
        makeMember({
          id: `legacy-captain-structures-${year}`,
          label: "Capitão · Estruturas",
          role: "captain",
          specialty: "structures",
          assignment: "structures",
          experience: 1.5,
          motivation: 75,
          joinYear: Math.max(1, year - 1),
          leaveYear: year + 2,
          captainArea: "structures",
          captainSince: year
        })
      );
    }

    return {
      members,
      candidates: candidateOffers(year),
      nominations: { aerodynamics: null, structures: null },
      captainHistory: year > 2
        ? teamRoles.map((area) => ({ year, area, memberId: members.find((member) => member.captainArea === area).id }))
        : [],
      weekReport: { week: 0, contributions: [] }
    };
  }

  function validate(team, year, reputation) {
    if (!team || !Array.isArray(team.members) || !Array.isArray(team.candidates) ||
      !team.nominations || !Array.isArray(team.captainHistory) || !team.weekReport ||
      !Number.isInteger(team.weekReport.week) || !Array.isArray(team.weekReport.contributions)) return false;
    const ids = new Set();
    const validMembers = team.members.every((member) => {
      if (!member || typeof member.id !== "string" || ids.has(member.id) ||
        typeof member.label !== "string" || !["president", "founder-captain", "member", "captain"].includes(member.role) ||
        !specialties.has(member.specialty) && member.specialty !== "management" ||
        !assignments.has(member.assignment) || !Number.isFinite(member.experience) ||
        member.experience < 0 || member.experience > 10 || !Number.isFinite(member.motivation) ||
        member.motivation < 0 || member.motivation > 100 || !Number.isInteger(member.joinYear) ||
        member.joinYear < 1 || (member.leaveYear !== null &&
          (!Number.isInteger(member.leaveYear) || member.leaveYear <= member.joinYear)) ||
        (member.captainArea !== null && !areas.has(member.captainArea)) ||
        (member.captainSince !== null && (!Number.isInteger(member.captainSince) || member.captainSince < member.joinYear))) {
        return false;
      }
      ids.add(member.id);
      if (member.role === "president") {
        return member.id === "president" && member.leaveYear === null && member.captainArea === null;
      }
      if (member.role === "founder-captain") {
        return member.leaveYear === 3 && member.captainArea !== null &&
          member.id === `founder-${member.captainArea}`;
      }
      if (member.role === "captain") return member.captainArea !== null && member.captainSince === year;
      return member.captainArea === null;
    });
    const presidents = team.members.filter((member) => member.role === "president");
    const captainAreas = team.members.filter((member) => member.captainArea !== null).map((member) => member.captainArea);
    if (!validMembers || presidents.length !== 1 || new Set(captainAreas).size !== captainAreas.length ||
      team.members.filter((member) => member.role === "captain" || member.role === "founder-captain").length > 2 ||
      team.members.length > teamCapacityForReputation(reputation)) return false;
    if (!teamRoles.every((area) => team.nominations[area] === null ||
      (typeof team.nominations[area] === "string" && team.members.some((member) =>
        member.id === team.nominations[area] && member.role === "member" && member.specialty === area
      ))) || new Set(teamRoles.map((area) => team.nominations[area]).filter(Boolean)).size !==
        teamRoles.map((area) => team.nominations[area]).filter(Boolean).length) return false;
    const validCandidates = new Set();
    if (!team.candidates.every((candidate) => {
      if (!candidate || typeof candidate.id !== "string" || validCandidates.has(candidate.id) ||
        typeof candidate.label !== "string" || !specialties.has(candidate.specialty) ||
        !Number.isFinite(candidate.cost) || candidate.cost < 0 ||
        !Number.isInteger(candidate.reputationRequired) || candidate.reputationRequired < 0 ||
        !Number.isFinite(candidate.experience) || candidate.experience < 0 || candidate.experience > 10) return false;
      validCandidates.add(candidate.id);
      return candidate.id === `candidate-${year}-${candidate.specialty}`;
    })) return false;
    return team.captainHistory.every((entry) => entry && Number.isInteger(entry.year) &&
      entry.year >= 1 && areas.has(entry.area) && typeof entry.memberId === "string") &&
      team.weekReport.week >= 0 && team.weekReport.week <= game.Content.weeksPerSeason &&
      team.weekReport.contributions.every((entry) => entry && typeof entry.memberId === "string" &&
        typeof entry.text === "string");
  }

  function advance(team, attributes, cash, year, week, seasonPhase) {
    const next = clone(team);
    const updatedAttributes = { ...attributes };
    let updatedCash = cash;
    const contributions = [];
    for (const member of next.members) {
      if (member.role === "president") continue;
      member.experience = Math.min(10, member.experience + 0.04);
      const assignment = teamAssignments.find(({ id }) => id === member.assignment);
      const matchesSpecialty = member.specialty === member.assignment;
      if (matchesSpecialty) member.motivation = Math.min(100, member.motivation + 0.7);
      else if (member.assignment === "mentoring") member.motivation = Math.min(100, member.motivation + 0.3);
      else member.motivation = Math.max(20, member.motivation - 0.2);

      const motivationFactor = 0.65 + member.motivation / 300;
      if (assignment.attribute &&
        (seasonPhase !== "final" || assignment.attribute === "report") &&
        (assignment.attribute !== "report" || seasonPhase === "final")) {
        const fitFactor = matchesSpecialty ? 1.15 : 0.75;
        const gain = Math.min(100 - updatedAttributes[assignment.attribute],
          (0.18 + member.experience * 0.045) * motivationFactor * fitFactor);
        updatedAttributes[assignment.attribute] = Math.min(100, updatedAttributes[assignment.attribute] + gain);
        contributions.push({
          memberId: member.id,
          text: `${assignment.label.split(" · ")[1]} +${gain.toFixed(1).replace(".", ",")}`
        });
      } else if (member.assignment === "fundraising") {
        const reward = Math.round(assignment.weeklyCredits * motivationFactor);
        updatedCash += reward;
        contributions.push({ memberId: member.id, text: `captação +${reward} créditos` });
      } else {
        const trained = next.nominations[member.specialty];
        const successor = next.members.find((candidate) => candidate.id === trained);
        if (successor) {
          successor.experience = Math.min(10, successor.experience + 0.08);
          successor.motivation = Math.min(100, successor.motivation + 0.2);
          contributions.push({ memberId: member.id, text: `mentoria de ${successor.label}` });
        } else {
          contributions.push({ memberId: member.id, text: "coordenação e documentação" });
        }
      }
    }
    next.weekReport = { week, contributions };
    return { team: next, attributes: updatedAttributes, cash: updatedCash };
  }

  function recruit(team, candidateId, year, reputation, cash) {
    const candidate = team.candidates.find((entry) => entry.id === candidateId);
    if (!candidate) return { ok: false, message: "Esta candidatura não está mais disponível." };
    if (team.members.length >= teamCapacityForReputation(reputation)) {
      return { ok: false, message: "A equipe atingiu o limite atual de integrantes." };
    }
    if (candidate.reputationRequired > reputation) {
      return { ok: false, message: `Esta candidatura exige ${candidate.reputationRequired} de reputação.` };
    }
    if (cash < candidate.cost) return { ok: false, message: "Créditos insuficientes para integrar esta pessoa." };
    const next = clone(team);
    next.candidates = next.candidates.filter((entry) => entry.id !== candidateId);
    next.members.push(makeMember({
      id: `member-${candidate.id}`,
      label: `${candidate.label} · Ano ${year}`,
      role: "member",
      specialty: candidate.specialty,
      assignment: candidate.specialty === "fundraising" ? "fundraising" : candidate.specialty,
      experience: candidate.experience,
      motivation: 76,
      joinYear: year,
      leaveYear: year + 3
    }));
    return { ok: true, team: next, cash: cash - candidate.cost, member: next.members.at(-1) };
  }

  function nextSeason(team, nextYear, reputation) {
    const next = clone(team);
    const currentYear = nextYear - 1;
    const departures = next.members.filter((member) =>
      member.role !== "president" && member.leaveYear <= nextYear
    );
    next.members = next.members.filter((member) => !departures.includes(member));
    next.members.forEach((member) => {
      if (member.role === "captain") {
        member.role = "member";
        member.captainArea = null;
        member.captainSince = null;
      }
    });

    if (currentYear === 1) {
      next.members.filter((member) => member.role === "founder-captain").forEach((member) => {
        next.captainHistory.push({ year: nextYear, area: member.captainArea, memberId: member.id });
      });
    }

    const promotions = [];
    if (nextYear >= 3) {
      for (const area of teamRoles) {
        const nomineeId = next.nominations[area];
        const nominee = next.members.find((member) => member.id === nomineeId &&
          member.role === "member" && member.specialty === area &&
          !(member.leaveYear !== null && member.leaveYear <= nextYear));
        const servedPreviousYear = (memberId) => next.captainHistory.some((entry) =>
          entry.memberId === memberId && entry.year === currentYear
        );
        const successor = nominee && !servedPreviousYear(nominee.id)
          ? nominee
          : next.members.filter((member) => member.role === "member" &&
            member.specialty === area && !servedPreviousYear(member.id) &&
            !(member.leaveYear !== null && member.leaveYear <= nextYear)
          ).sort((first, second) =>
            second.experience - first.experience || second.motivation - first.motivation
          )[0];
        if (successor) {
          successor.role = "captain";
          successor.captainArea = area;
          successor.captainSince = nextYear;
          successor.assignment = area;
          next.captainHistory.push({ year: nextYear, area, memberId: successor.id });
          promotions.push(`${successor.label} assumiu a capitania de ${area === "aerodynamics" ? "Aerodinâmica" : "Estruturas"}`);
        } else {
          promotions.push(`capitania de ${area === "aerodynamics" ? "Aerodinâmica" : "Estruturas"} vaga`);
        }
      }
    }

    next.nominations = { aerodynamics: null, structures: null };
    next.candidates = candidateOffers(nextYear).filter((candidate) =>
      candidate.reputationRequired <= reputation
    );
    next.weekReport = { week: 0, contributions: [] };
    return { team: next, departures, promotions };
  }

  game.Team = Object.freeze({
    create,
    validate,
    advance,
    recruit,
    nextSeason,
    candidateOffers
  });
})();
