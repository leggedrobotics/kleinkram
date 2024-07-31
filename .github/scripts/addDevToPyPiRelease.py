import tomlkit, datetime

file_path = 'pyproject.toml'
with open(file_path, 'r') as file:
    data = tomlkit.load(file)
    data['project']['version'] += '-dev' + datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S')
with open(file_path, 'w') as file:
    tomlkit.dump(data, file)
