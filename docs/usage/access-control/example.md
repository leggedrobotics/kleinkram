# Example

::: tip An example of how the Kleinkram Access System was intended to be used
This scenario shows how access rights can be granted to individuals and groups.
The chapter illustrate:

- Affiliation Groups
- Individual Access Rights
- Groups
- Admins

:::

## Affiliation Groups

The PhD student Hans is part of the RoboticsCorp and has a @roboticscorp.com email. Thus he is part of the Affiliation Group RoboticsCorp.
For his research about Coffee enhanced Robots, he creates a new project called "**AnyCoffee**" in the RoboticsCorp Affiliation Group.

As the creator of the project, he gets <Delete/> rights on the project. All other RoboticsCorp members get <Create/> rights on the project.
His studies are split into two parts: "normal" and "decaf". He creates two missions, "_Normal_" and "_Decaf_" in the project "**AnyCoffee**".
The missions are linked to the project, so all RoboticsCorp members also get <Create/> rights on the missions.

## Individual Access Rights

As the experiments for the "_Decaf_" mission are done by the student Marie, who is not part of RoboticsCorp, Hans adds
her to the project "**AnyCoffee**" with <Write/> rights. Access can only be granted per project, so Marie gets these
rights on both missions.

Marie can now upload files to the "_Decaf_" mission, and also delete them as she then is the creator of the files.
Also she can add & remove metadata on the mission. Or she could rename the mission, but she does not have the rights to delete it.

To run compute on the files Marie uploaded to the mission, she can create an Action Template and launch it as an Action on the mission.
But Marie can also view & use the Action Templates of Hans, as those only require <Any/> rights. The Action Marie launches can
only be stopped by her as the <Creator/> or by Hans as he has <Delete/> rights on the Project, thus on the mission and thus on the action.
To show Marie how to launch actions, Hans launches the example action template 'roboticscorp/action:simple-latest' on the "_Decaf_" mission.
Marie can see the action and its results. As she has the rights needed to launch that template, she can also stop it, but she
cannot delete it, which needs <Delete/>.

As the creator of her files, Marie can also move them to the "_Normal_" mission, as she has <Create/> there.

## Groups

As the results of the "_Normal_" mission are promising, Hans wants to get more people involved. He creates an Access Group called "Caffeine" and adds Patrik and Peter to it.
Patrik and Peter were already part of the RoboticsCorp, so they already had <Create/> rights on the project but couldn't contribute easily.
Now, by linking the Access Group "Caffeine" to the project "**AnyCoffee**" with <Write/> rights, they can also for example change which metadata types the project requires.

To share their results with the external collaborator, the company "Berger Coffee", Patrik creates a new Access Group called "Berger" and adds the external collaborators to it.
Patrik links the Access Group "Berger" to the project "**AnyCoffee**" with <Read/> rights, so the external collaborator can view the results but not change them.
As Patrik himself only had <Write/> rights on the project "**AnyCoffee**", he could not have granted the external collaborator more rights than he had himself.

## Admins

When Marie noticed that an action Hans launched is stuck, she asks an Admin to stop it. The Admin can stop the action as they
have all available rights on all resources. As with great power comes great responsibility, only the developers of the system and the system administrators have Admin rights.
