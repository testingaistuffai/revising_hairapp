{ pkgs, ... }: {
  channel = "unstable"; 

  packages = [
    # 1. PYTHON CORE
    pkgs.python3
    
    # 2. NODE FIX: Use the latest stable channel (22) and hope it resolves to 22.12+
    pkgs.nodejs_22

    # 3. OPENCV SYSTEM DEPENDENCIES (The Fix for libgthread and libGL)
    pkgs.libglvnd 
    pkgs.glib 
    
    # 4. PYTHON AI PACKAGES: Use the versioned OpenCV to avoid conflicts
    pkgs.python3Packages.opencv4 
  ];

  idx = {
    # ... (Keep existing extensions) ...
    extensions = [
      "ms-python.python"
      "ms-python.debugpy"
      "visualstudioexptteam.vscodeintellicode"
    ];

    workspace = {
      onCreate = {
        # CRITICAL: This needs to run *after* the Nix packages are built.
        install = ''
          # 1. Install Python Dependencies
          python3 -m venv .venv 
          source .venv/bin/activate 
          # This command will now succeed because libgthread and OpenCV are present system-wide
          pip install -r requirements.txt
          
          # 2. Install Node/Frontend Dependencies
          npm install --prefix frontend
          npm run build --prefix frontend
        '';
      };
       # Start the web server and open a preview.
      onStart = {
        web-preview = "./devserver.sh";
      };
      # ... (Rest of the workspace config) ...
    };
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["./devserver.sh"];
          manager = "web";
        };
      };
    };
  };
}
