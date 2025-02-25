import pygame
import sys
import random
import os
from datetime import datetime

# Initialize Pygame modules
pygame.init()
pygame.font.init()
pygame.mixer.init()

# ======== GAME CONFIGURATION ========
SCREEN_SIZE = (1280, 720)
FPS = 60
SAVE_VERSION = "2.8"
FONT_DIR = "fonts"
START_YEAR = 1980

# ======== FONT SETUP ========
try:
    milky_path = os.path.join(FONT_DIR, "Milky Week.ttf")
    momentz_path = os.path.join(FONT_DIR, "Momentz.ttf")
    
    TITLE_FONT = pygame.font.Font(milky_path, 82)
    BUTTON_FONT = pygame.font.Font(momentz_path, 38)
    STAT_FONT = pygame.font.Font(momentz_path, 28)

except Exception as e:
    print(f"Font Error: {str(e)}")
    TITLE_FONT = pygame.font.Font(None, 72)
    BUTTON_FONT = pygame.font.Font(None, 32)
    STAT_FONT = pygame.font.Font(None, 24)

# ======== COLOR PALETTE ========
COLORS = {
    "background": (18, 18, 30),
    "primary": (100, 80, 255),
    "secondary": (255, 100, 150),
    "accent": (0, 255, 200),
    "text": (245, 245, 245),
    "dark": (30, 30, 50),
    "success": (100, 255, 150),
    "danger": (255, 80, 80),
    "warning": (255, 200, 0),
    "boss_glow": (255, 223, 0),
    "property": (80, 200, 120),
    "racket": (200, 100, 255),
    "graveyard": (40, 40, 60)
}

# ======== DISTRICT CONFIGURATION ========
DISTRICTS = {
    "Downtown": {
        "rect": pygame.Rect(200, 100, 300, 200),
        "color": (100, 80, 255),
        "income": 800,
        "risk": 30,
        "controlled": False
    },
    "Industrial Zone": {
        "rect": pygame.Rect(900, 100, 300, 200),
        "color": (255, 140, 0),
        "income": 1500,
        "risk": 40,
        "controlled": False
    },
    "Docks": {
        "rect": pygame.Rect(600, 300, 300, 200),
        "color": (80, 180, 255),
        "income": 1200,
        "risk": 50,
        "controlled": False
    },
    "Suburbs": {
        "rect": pygame.Rect(200, 400, 300, 200),
        "color": (100, 255, 150),
        "income": 500,
        "risk": 15,
        "controlled": False
    }
}

# ======== PROPERTY CONFIGURATION ========
PROPERTIES = {
    "Bar": {
        "base_cost": 5000,
        "rect": pygame.Rect(400, 200, 200, 150),
        "rackets": {
            "Illegal Gambling": {"cost": 2000, "income": 800},
            "Drug Trade": {"cost": 5000, "income": 1500},
            "Protection Racket": {"cost": 3000, "income": 500}
        },
        "upgrade_cost": 10000,
        "max_rackets": 3
    },
    "Nightclub": {
        "base_cost": 15000,
        "rect": pygame.Rect(650, 200, 200, 150),
        "rackets": {
            "VIP Scam": {"cost": 5000, "income": 2000},
            "Money Laundering": {"cost": 10000, "income": 3500},
            "Prostitution Ring": {"cost": 8000, "income": 2500}
        },
        "upgrade_cost": 25000,
        "max_rackets": 5
    },
    "Deli Shop": {
        "base_cost": 3000,
        "rect": pygame.Rect(400, 400, 200, 150),
        "rackets": {
            "Loan Sharking": {"cost": 1500, "income": 400},
            "Counterfeit Goods": {"cost": 2500, "income": 600}
        },
        "upgrade_cost": 6000,
        "max_rackets": 2
    },
    "Pizza Shop": {
        "base_cost": 4000,
        "rect": pygame.Rect(650, 400, 200, 150),
        "rackets": {
            "Drug Front": {"cost": 3000, "income": 800},
            "Smuggling Hub": {"cost": 5000, "income": 1200}
        },
        "upgrade_cost": 8000,
        "max_rackets": 3
    }
}

# ======== GAME STATE CLASS ========
class GameState:
    def __init__(self):
        self.screen = pygame.display.set_mode(SCREEN_SIZE)
        self.clock = pygame.time.Clock()
        self.running = True
        self.current_screen = "main_menu"
        self.player = {"name": "", "money": 1000, "respect": 50, "health": 100}
        self.family = {"name": "", "members": [], "year": START_YEAR}
        self.particles = ParticleFX()
        self.bg_offset = 0
        self.bg_speed = 0.5
        self.properties = {
            "owned": [],
            "current_selected": None,
            "upgrades": {}
        }
        pygame.display.set_caption("Mafia Life: Neon Nights")

    def switch_screen(self, new_screen):
        self.current_screen = new_screen

    def advance_year(self):
        try:
            self.family["year"] += 1
            self._age_crew()
            self._handle_annual_events()
            self._collect_district_income()
            self._collect_property_income()
        except Exception as e:
            print(f"Year advancement error: {str(e)}")

    def _age_crew(self):
        for member in self.family["members"]:
            if isinstance(member, CrewMember):
                member.age += 1
                if member.age > 50 and random.random() < 0.05:
                    member.status = "Deceased"
                    member.death_year = self.family["year"]

    def _handle_annual_events(self):
        events = [
            ("Good Year", "Money +2000", "cash", 2000),
            ("Plague", "Lost 2 crew members", "damage", -2),
            ("Police Crackdown", "Respect -20", "respect", -20)
        ]
        event = random.choice(events)
        self.particles.add_effect((640, 360), event[2])
        
        if event[3] > 0:
            self.player["money"] += event[3]
        else:
            if event[0] == "Plague":
                alive_members = [m for m in self.family["members"] if m.status == "Alive"]
                for _ in range(min(2, len(alive_members))):
                    if alive_members:
                        member = random.choice(alive_members)
                        member.status = "Deceased"
                        member.death_year = self.family["year"]
            elif event[0] == "Police Crackdown":
                self.player["respect"] = max(0, self.player["respect"] + event[3])

    def _collect_district_income(self):
        for district in DISTRICTS.values():
            if district["controlled"]:
                self.player["money"] += district["income"]
                self.particles.add_effect((640, 360), "cash")

    def _collect_property_income(self):
        for prop in self.properties["owned"]:
            for racket in prop["rackets"]:
                self.player["money"] += racket["income"]
                self.particles.add_effect((640, 360), "cash")

# ======== CREW SYSTEM ========
class CrewMember:
    RANKS = {
        1: {"name": "Associate", "promotion_cost": 500, "respect_req": 0},
        2: {"name": "Soldier", "promotion_cost": 1500, "respect_req": 30},
        3: {"name": "Capo", "promotion_cost": 4000, "respect_req": 50},
        4: {"name": "Underboss", "promotion_cost": 10000, "respect_req": 70},
        5: {"name": "Boss", "promotion_cost": 25000, "respect_req": 90}
    }
    
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.full_name = f"{first_name} {last_name}"
        self.age = age
        self.loyalty = random.randint(30, 100)
        self.status = "Alive"
        self.rank = 1
        self.in_jail = False
        self.is_boss = False
        self.skills = {
            "combat": random.randint(1, 100),
            "negotiation": random.randint(1, 100),
            "stealth": random.randint(1, 100)
        }
        self.death_year = None

    def promote(self):
        if self.rank < 5:
            self.rank += 1
            self.loyalty = min(100, self.loyalty + 15)
            
    def demote(self):
        if self.rank > 1:
            self.rank -= 1
            self.loyalty = max(0, self.loyalty - 25)

class MafiaFamily:
    NAMES = {
        "first": ["Vito", "Michael", "Santino", "Fredo", "Tom", "Peter", "Sal"],
        "last": ["Corleone", "Tattaglia", "Barzini", "Cuneo", "Stracci", "Clemenza"]
    }
    
    @classmethod
    def generate_recruit(cls):
        first = random.choice(cls.NAMES["first"])
        last = random.choice(cls.NAMES["last"])
        age = random.randint(20, 35)
        return CrewMember(first, last, age)
    
    @classmethod
    def generate_crew(cls, count=5):
        return [cls.generate_recruit() for _ in range(count)]

# ======== PARTICLE SYSTEM ========
class ParticleFX:
    def __init__(self):
        self.particles = []
    
    def add_effect(self, pos, effect_type, count=15):
        colors = {
            "cash": [(255,215,0), (255,165,0)],
            "damage": [(255,0,0), (200,0,0)],
            "heal": [(0,255,100), (0,200,50)],
            "respect": [(100,80,255), (150,130,255)]
        }
        for _ in range(count):
            self.particles.append({
                "pos": list(pos),
                "color": random.choice(colors[effect_type]),
                "size": random.randint(8, 15),
                "speed": [random.uniform(-3,3), random.uniform(-5,-2)],
                "life": random.randint(20,40)
            })
    
    def update(self):
        for p in self.particles[:]:
            p["pos"][0] += p["speed"][0]
            p["pos"][1] += p["speed"][1]
            p["life"] -= 1
            if p["life"] <= 0:
                self.particles.remove(p)
    
    def draw(self, surface):
        for p in self.particles:
            alpha = min(255, p["life"]*10)
            pygame.draw.circle(surface, p["color"] + (alpha,), 
                             (int(p["pos"][0]), int(p["pos"][1])), 
                             int(p["size"]))

# ======== UI COMPONENTS ========
class ModernButton:
    def __init__(self, rect, text, action=None):
        self.rect = pygame.Rect(rect)
        self.text = text
        self.action = action
        self.hover = False
    
    def draw(self, surface, mouse_pos):
        self.hover = self.rect.collidepoint(mouse_pos)
        bg_color = COLORS["primary"] if self.hover else COLORS["dark"]
        border_color = COLORS["accent"]
        
        pygame.draw.rect(surface, bg_color, self.rect, border_radius=12)
        pygame.draw.rect(surface, border_color, self.rect, 3, border_radius=12)
        
        text_surf = BUTTON_FONT.render(self.text, True, COLORS["text"])
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)

# ======== GAME SCREENS ========
def main_menu(state):
    buttons = [
        ModernButton((540, 300, 200, 60), "New Game", "new_game"),
        ModernButton((540, 400, 200, 60), "Load Game", "load_game"),
        ModernButton((540, 500, 200, 60), "Quit", "quit")
    ]
    
    while state.running and state.current_screen == "main_menu":
        mouse_pos = pygame.mouse.get_pos()
        state.screen.fill(COLORS["background"])
        
        # Animated background
        for y in range(-100, SCREEN_SIZE[1], 100):
            for x in range(-100, SCREEN_SIZE[0], 100):
                pos = (x + state.bg_offset, y + state.bg_offset)
                pygame.draw.circle(state.screen, (50,50,80), pos, 30)
        
        # Title
        title_text = TITLE_FONT.render("NEON MAFIA", True, COLORS["accent"])
        title_rect = title_text.get_rect(center=(640, 150))
        state.screen.blit(title_text, title_rect)
        
        # Buttons
        for btn in buttons:
            btn.draw(state.screen, mouse_pos)
        
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                state.running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                for btn in buttons:
                    if btn.rect.collidepoint(event.pos):
                        if btn.action == "quit":
                            state.running = False
                        else:
                            state.switch_screen(btn.action)
        
        pygame.display.flip()
        state.clock.tick(FPS)

def new_game(state):
    state.player = {"name": "Player", "money": 10000, "respect": 50, "health": 100}
    state.family = {
        "name": "The Syndicate",
        "members": MafiaFamily.generate_crew(),
        "year": START_YEAR
    }
    state.switch_screen("main_game")

def main_game(state):
    buttons = [
        ModernButton((50, 50, 200, 60), "Menu", "main_menu"),
        ModernButton((1030, 50, 200, 60), "Map", "map"),
        ModernButton((1030, 150, 200, 60), "Crew", "crew"),
        ModernButton((1030, 250, 200, 60), "Recruit", "recruit"),
        ModernButton((1030, 350, 200, 60), "Properties", "property"),
        ModernButton((1030, 450, 200, 60), "Continue Year", "advance_year"),
    ]
    
    while state.running and state.current_screen == "main_game":
        mouse_pos = pygame.mouse.get_pos()
        state.screen.fill(COLORS["background"])
        
        state.particles.update()
        
        # Draw stats
        year_text = STAT_FONT.render(f"Year: {state.family['year']}", True, COLORS["text"])
        money_text = STAT_FONT.render(f"Money: ${state.player['money']}", True, COLORS["text"])
        respect_text = STAT_FONT.render(f"Respect: {state.player['respect']}", True, COLORS["text"])
        health_text = STAT_FONT.render(f"Health: {state.player['health']}", True, COLORS["text"])
        
        state.screen.blit(year_text, (50, 150))
        state.screen.blit(money_text, (50, 200))
        state.screen.blit(respect_text, (50, 250))
        state.screen.blit(health_text, (50, 300))
        
        # Crew summary
        alive_crew = len([m for m in state.family["members"] if m.status == "Alive"])
        crew_text = STAT_FONT.render(f"Crew Members: {alive_crew}", True, COLORS["text"])
        state.screen.blit(crew_text, (50, 350))
        
        state.particles.draw(state.screen)
        
        for btn in buttons:
            btn.draw(state.screen, mouse_pos)
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                state.running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                for btn in buttons:
                    if btn.rect.collidepoint(event.pos):
                        if btn.action == "advance_year":
                            state.advance_year()
                        else:
                            state.switch_screen(btn.action)
        
        pygame.display.flip()
        state.clock.tick(FPS)

def map_screen(state):
    back_btn = ModernButton((50, 50, 200, 60), "Back", "main_game")
    buttons = [back_btn]  # Fixed indentation
    
    while state.running and state.current_screen == "map":
        mouse_pos = pygame.mouse.get_pos()
        state.screen.fill(COLORS["background"])
        
        state.particles.update()
        
        # Draw districts
        for name, district in DISTRICTS.items():
            color = district["color"]
            if district["controlled"]:
                color = tuple(min(c + 50, 255) for c in color)
                border = 0
            else:
                border = 4
                
            pygame.draw.rect(state.screen, color, district["rect"], border_radius=12)
            pygame.draw.rect(state.screen, COLORS["dark"], district["rect"], border, border_radius=12)
            
            # District info
            text = STAT_FONT.render(name, True, COLORS["text"])
            text_rect = text.get_rect(center=district["rect"].center)
            state.screen.blit(text, text_rect)
            
            status = "Controlled" if district["controlled"] else f"Risk: {district['risk']}%"
            status_text = STAT_FONT.render(status, True, COLORS["text"])
            status_rect = status_text.get_rect(midbottom=district["rect"].midtop)
            state.screen.blit(status_text, status_rect)
        
        state.particles.draw(state.screen)
        
        for btn in buttons:
            btn.draw(state.screen, mouse_pos)
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                state.running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                for btn in buttons:
                    if btn.rect.collidepoint(event.pos):
                        state.switch_screen(btn.action)
                
                for name, district in DISTRICTS.items():
                    if district["rect"].collidepoint(event.pos):
                        handle_district_click(state, name)
        
        pygame.display.flip()
        state.clock.tick(FPS)

def handle_district_click(state, district_name):
    district = DISTRICTS[district_name]
    if district["controlled"]:
        state.player["money"] += district["income"]
        state.particles.add_effect(pygame.mouse.get_pos(), "cash")
    else:
        success_chance = state.player["respect"] / 100
        if random.random() < success_chance:
            district["controlled"] = True
            state.player["respect"] += 10
            state.particles.add_effect(pygame.mouse.get_pos(), "respect")
        else:
            state.player["health"] -= 10
            state.player["money"] -= 200
            state.particles.add_effect(pygame.mouse.get_pos(), "damage")

def crew_management(state):
    back_btn = ModernButton((50, 50, 200, 60), "Back", "main_game")
    grave_btn = ModernButton((1030, 650, 200, 60), "Graveyard", "graveyard")
    selected_member = None
    
    while state.running and state.current_screen == "crew":
        mouse_pos = pygame.mouse.get_pos()
        state.screen.fill(COLORS["background"])
        
        # Title
        title_text = TITLE_FONT.render("Crew Management", True, COLORS["accent"])
        state.screen.blit(title_text, (50, 100))
        
        # Member list
        y_pos = 200
        for i, member in enumerate(state.family["members"]):
            if y_pos > 600: break
            color = COLORS["success"] if member.status == "Alive" else COLORS["danger"]
            rank_name = CrewMember.RANKS[member.rank]["name"]
            text = STAT_FONT.render(
                f"{member.full_name} | {rank_name} | Loyalty: {member.loyalty}%",
                True, color
            )
            text_rect = text.get_rect(topleft=(100, y_pos))
            
            # Selection box
            if text_rect.collidepoint(mouse_pos):
                pygame.draw.rect(state.screen, COLORS["dark"], text_rect.inflate(10,5), border_radius=5)
                if pygame.mouse.get_pressed()[0]:
                    selected_member = member if member.status == "Alive" else None
            
            state.screen.blit(text, (100, y_pos))
            y_pos += 40
        
        # Selected member actions
        if selected_member:
            draw_member_details(state, selected_member)
            
            # Promotion button
            promote_cost = CrewMember.RANKS.get(selected_member.rank+1, {}).get("promotion_cost", 0)
            promote_btn = ModernButton(
                (800, 500, 200, 50), 
                f"Promote (${promote_cost})", 
                "promote"
            )
            
            # Whack button
            whack_btn = ModernButton((800, 570, 200, 50), "Whack", "whack")
            
            promote_btn.draw(state.screen, mouse_pos)
            whack_btn.draw(state.screen, mouse_pos)
            
            # Handle action buttons
            for event in pygame.event.get():
                if event.type == pygame.MOUSEBUTTONDOWN:
                    if promote_btn.rect.collidepoint(event.pos):
                        handle_promotion(state, selected_member)
                    elif whack_btn.rect.collidepoint(event.pos):
                        handle_whacking(state, selected_member)
                        selected_member = None
        
        # Buttons
        back_btn.draw(state.screen, mouse_pos)
        grave_btn.draw(state.screen, mouse_pos)
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                state.running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if back_btn.rect.collidepoint(event.pos):
                    state.switch_screen(back_btn.action)
                elif grave_btn.rect.collidepoint(event.pos):
                    state.switch_screen("graveyard")
        
        pygame.display.flip()
        state.clock.tick(FPS)

def draw_member_details(state, member):
    details_y = 200
    pygame.draw.rect(state.screen, COLORS["dark"], (700, 150, 500, 500), border_radius=12)
    
    # Basic info
    text = STAT_FONT.render(f"{member.full_name}", True, COLORS["text"])
    state.screen.blit(text, (720, details_y))
    details_y += 40
    
    # Rank info
    rank_info = CrewMember.RANKS[member.rank]
    text = STAT_FONT.render(f"Rank: {rank_info['name']}", True, COLORS["accent"])
    state.screen.blit(text, (720, details_y))
    details_y += 30
    
    # Skills
    text = STAT_FONT.render("Skills:", True, COLORS["text"])
    state.screen.blit(text, (720, details_y))
    details_y += 30
    
    for skill, value in member.skills.items():
        text = STAT_FONT.render(f"{skill.title()}: {value}", True, COLORS["text"])
        state.screen.blit(text, (740, details_y))
        details_y += 25
    
    # Loyalty meter
    pygame.draw.rect(state.screen, COLORS["dark"], (720, details_y, 200, 20))
    pygame.draw.rect(state.screen, COLORS["primary"], 
                    (720, details_y, int(200*(member.loyalty/100)), 20))
    details_y += 30

def handle_promotion(state, member):
    next_rank = member.rank + 1
    if next_rank in CrewMember.RANKS:
        req = CrewMember.RANKS[next_rank]
        if state.player["money"] >= req["promotion_cost"] and state.player["respect"] >= req["respect_req"]:
            state.player["money"] -= req["promotion_cost"]
            member.promote()
            state.particles.add_effect((900, 500), "respect")

def handle_whacking(state, member):
    member.status = "Deceased"
    member.death_year = state.family["year"]
    state.player["respect"] += 5
    for m in state.family["members"]:
        if m.status == "Alive" and m != member:
            m.loyalty = max(0, m.loyalty - random.randint(5, 15))
    state.particles.add_effect((900, 500), "damage")

def recruit_screen(state):
    back_btn = ModernButton((50, 50, 200, 60), "Back", "main_game")
    recruits = [MafiaFamily.generate_recruit() for _ in range(3)]
    
    while state.running and state.current_screen == "recruit":
        mouse_pos = pygame.mouse.get_pos()
        state.screen.fill(COLORS["background"])
        
        # Title
        title_text = TITLE_FONT.render("Recruitment Office", True, COLORS["accent"])
        state.screen.blit(title_text, (50, 100))
        
        # Draw recruits
        draw_recruitment_panel(state, recruits, mouse_pos)
        
        # Handle recruitment
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                state.running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if back_btn.rect.collidepoint(event.pos):
                    state.switch_screen(back_btn.action)
                else:
                    handle_recruitment(state, recruits)
        
        # Back button
        back_btn.draw(state.screen, mouse_pos)
        
        pygame.display.flip()
        state.clock.tick(FPS)

def draw_recruitment_panel(state, recruits, mouse_pos):
    pygame.draw.rect(state.screen, COLORS["dark"], (300, 150, 680, 500), border_radius=12)
    title = STAT_FONT.render("Available Recruits", True, COLORS["accent"])
    state.screen.blit(title, (320, 170))
    
    x_pos = 320
    for i, recruit in enumerate(recruits):
        box = pygame.Rect(x_pos, 220, 200, 300)
        pygame.draw.rect(state.screen, COLORS["secondary"] if box.collidepoint(mouse_pos) else COLORS["dark"], 
                        box, border_radius=12)
        
        # Recruit info
        text_y = box.y + 20
        state.screen.blit(STAT_FONT.render(recruit.full_name, True, COLORS["text"]), 
                         (box.x+10, text_y))
        text_y += 30
        
        for skill, value in recruit.skills.items():
            state.screen.blit(STAT_FONT.render(f"{skill.title()}: {value}", True, COLORS["text"]),
                            (box.x+20, text_y))
            text_y += 25
        
        cost = 2000 + sum(recruit.skills.values())*10
        state.screen.blit(STAT_FONT.render(f"Cost: ${cost}", True, COLORS["success"]),
                        (box.x+10, box.bottom-40))
        
        x_pos += 220

def handle_recruitment(state, recruits):
    for i, recruit in enumerate(recruits):
        box = pygame.Rect(320 + i*220, 220, 200, 300)
        if box.collidepoint(pygame.mouse.get_pos()):
            cost = 2000 + sum(recruit.skills.values())*10
            if state.player["money"] >= cost:
                state.player["money"] -= cost
                state.family["members"].append(recruit)
                state.particles.add_effect(pygame.mouse.get_pos(), "cash")

def property_management(state):
    back_btn = ModernButton((50, 50, 200, 60), "Back", "main_game")
    
    while state.running and state.current_screen == "property":
        mouse_pos = pygame.mouse.get_pos()
        state.screen.fill(COLORS["background"])
        
        # Title
        title_text = TITLE_FONT.render("Property Management", True, COLORS["accent"])
        state.screen.blit(title_text, (50, 100))
        
        # Draw available properties
        draw_properties(state, mouse_pos)
        
        # Draw owned properties
        draw_owned_properties(state, mouse_pos)
        
        # Back button
        back_btn.draw(state.screen, mouse_pos)
        
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                state.running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if back_btn.rect.collidepoint(event.pos):
                    state.switch_screen(back_btn.action)
                else:
                    # Check property purchases
                    purchased = False
                    for prop_name, prop_data in PROPERTIES.items():
                        if prop_data["rect"].collidepoint(event.pos):
                            if not any(p["name"] == prop_name for p in state.properties["owned"]):
                                if state.player["money"] >= prop_data["base_cost"]:
                                    state.player["money"] -= prop_data["base_cost"]
                                    state.properties["owned"].append({
                                        "name": prop_name,
                                        "rackets": [],
                                        "max_rackets": prop_data["max_rackets"],
                                        "upgrade_level": 1
                                    })
                                    state.particles.add_effect(event.pos, "cash")
                                    purchased = True
                                    break
                    
                    # If not purchasing, check owned properties
                    if not purchased:
                        handle_property_click(state, mouse_pos)
        
        pygame.display.flip()
        state.clock.tick(FPS)

def draw_properties(state, mouse_pos):
    y_pos = 200
    for prop_name, prop_data in PROPERTIES.items():
        if any(p["name"] == prop_name for p in state.properties["owned"]):
            continue
            
        bg_color = COLORS["property"] if prop_data["rect"].collidepoint(mouse_pos) else COLORS["dark"]
        pygame.draw.rect(state.screen, bg_color, prop_data["rect"], border_radius=12)
        
        text = STAT_FONT.render(f"{prop_name} (${prop_data['base_cost']})", True, COLORS["text"])
        text_rect = text.get_rect(center=prop_data["rect"].center)
        state.screen.blit(text, text_rect)

def draw_owned_properties(state, mouse_pos):
    y_pos = 600
    for prop in state.properties["owned"]:
        pygame.draw.rect(state.screen, COLORS["property"], (50, y_pos, 400, 60), border_radius=8)
        text = STAT_FONT.render(
            f"{prop['name']} (Rackets: {len(prop['rackets'])}/{prop['max_rackets']})", 
            True, COLORS["text"]
        )
        state.screen.blit(text, (60, y_pos + 15))
        y_pos += 70

def handle_property_click(state, mouse_pos):
    for prop in state.properties["owned"]:
        prop_rect = pygame.Rect(50, 600 + (state.properties["owned"].index(prop) * 70), 400, 60)
        if prop_rect.collidepoint(mouse_pos):
            state.properties["current_selected"] = prop
            show_property_menu(state, prop)

def show_property_menu(state, prop):
    menu_rect = pygame.Rect(500, 200, 600, 400)
    pygame.draw.rect(state.screen, COLORS["dark"], menu_rect, border_radius=12)
    
    # Property info
    title_text = STAT_FONT.render(f"{prop['name']} (Level {prop['upgrade_level']})", True, COLORS["accent"])
    state.screen.blit(title_text, (520, 220))
    
    # Racket list
    y_pos = 280
    for racket_name, racket_data in PROPERTIES[prop["name"]]["rackets"].items():
        installed = any(r["name"] == racket_name for r in prop["rackets"])
        color = COLORS["success"] if installed else COLORS["racket"]
        
        pygame.draw.rect(state.screen, color, (510, y_pos, 580, 40), border_radius=6)
        text = STAT_FONT.render(
            f"{racket_name} (${racket_data['cost']} | ${racket_data['income']}/year)",
            True, COLORS["text"]
        )
        state.screen.blit(text, (520, y_pos + 5))
        
        # Handle racket installation
        if pygame.Rect(510, y_pos, 580, 40).collidepoint(pygame.mouse.get_pos()):
            if not installed and len(prop["rackets"]) < prop["max_rackets"]:
                if state.player["money"] >= racket_data["cost"]:
                    state.player["money"] -= racket_data["cost"]
                    prop["rackets"].append({
                        "name": racket_name,
                        "income": racket_data["income"]
                    })
        
        y_pos += 50
    
    # Upgrade system
    upgrade_cost = PROPERTIES[prop["name"]]["upgrade_cost"] * prop["upgrade_level"]
    upgrade_btn = ModernButton((700, 600, 200, 60), f"Upgrade (${upgrade_cost})", "upgrade")
    upgrade_btn.draw(state.screen, pygame.mouse.get_pos())
    
    if upgrade_btn.rect.collidepoint(pygame.mouse.get_pos()):
        if state.player["money"] >= upgrade_cost:
            state.player["money"] -= upgrade_cost
            prop["max_rackets"] += 1
            prop["upgrade_level"] += 1
            state.particles.add_effect(pygame.mouse.get_pos(), "cash")

def graveyard_screen(state):
    back_btn = ModernButton((50, 50, 200, 60), "Back", "crew")
    
    while state.running and state.current_screen == "graveyard":
        mouse_pos = pygame.mouse.get_pos()
        state.screen.fill(COLORS["graveyard"])
        
        # Title
        title_text = TITLE_FONT.render("Family Graveyard", True, COLORS["danger"])
        state.screen.blit(title_text, (50, 100))
        
        # List deceased members
        y_pos = 200
        for member in state.family["members"]:
            if member.status == "Deceased":
                text = STAT_FONT.render(
                    f"{member.full_name} ({member.death_year})", 
                    True, COLORS["text"]
                )
                state.screen.blit(text, (100, y_pos))
                y_pos += 40
        
        # Back button
        back_btn.draw(state.screen, mouse_pos)
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                state.running = False
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if back_btn.rect.collidepoint(event.pos):
                    state.switch_screen(back_btn.action)
        
        pygame.display.flip()
        state.clock.tick(FPS)

# ======== MAIN LOOP ========
if __name__ == "__main__":
    state = GameState()
    
    while state.running:
        if state.current_screen == "main_menu":
            main_menu(state)
        elif state.current_screen == "new_game":
            new_game(state)
        elif state.current_screen == "main_game":
            main_game(state)
        elif state.current_screen == "map":
            map_screen(state)
        elif state.current_screen == "crew":
            crew_management(state)
        elif state.current_screen == "recruit":
            recruit_screen(state)
        elif state.current_screen == "property":
            property_management(state)
        elif state.current_screen == "graveyard":
            graveyard_screen(state)
    
    pygame.quit()
    sys.exit()
