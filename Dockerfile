version: 1.3
build:
  file: "ellipsis.Dockerfile"
  commands: 
    - name: "install_dependencies"
      description: "Installs all of the dependencies required to run the project."
      command: "npm i"
    - name: "format"
      description: "Runs our prettier formatter on the project to ensure that all of the code is formatted correctly."
      command: "npm run prettier"
    - name: "lint"
      description: "Runs all of our linting rules on the project to ensure that all of the code is using optimal standards."
      command: "npm i"
    - name: "run_tests"
      description: "Runs the all of the tests."
      command: "npm t -- --proj unit"